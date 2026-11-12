import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { AuthService } from "@/auth/auth-service";
import { generateToken, hashToken, normalizeEmail } from "@/auth/tokens";
import type { Database } from "@/db/client";
import { invitations, users } from "@/db/schema";
import type { PaymentGateway } from "@/payments/payment-gateway";
import type { PaymentService } from "@/payments/payment-service";
import type { RateLimiter } from "@/rate-limits/rate-limiter";
import { getTemplate, listTemplates } from "@/templates/registry";
import { isWithinEditWindow } from "./edit-window";
import { canChangeLockedName } from "./name-lock";

/** Who is asking: the edit-token cookie of the original device and/or a signed-in user. */
export interface Access {
  editToken?: string;
  userId?: string;
}

export type Invitation = typeof invitations.$inferSelect;

export type SaveResult =
  | { status: "saved" }
  | { status: "not_found" }
  | { status: "invalid"; issues: { path: string; message: string }[] }
  | { status: "names_locked" }
  | { status: "edit_window_closed" };

const emailSchema = z.email();

export function createInvitationService({
  db,
  auth,
  gateway,
  paymentService,
  rateLimiter,
  baseUrl,
  priceClp,
  now = () => new Date(),
}: {
  db: Database;
  auth: AuthService;
  gateway: PaymentGateway;
  paymentService: PaymentService;
  rateLimiter: RateLimiter;
  baseUrl: string;
  priceClp: number;
  now?: () => Date;
}) {
  async function load(invitationId: string, access: Access): Promise<Invitation | null> {
    if (!z.uuid().safeParse(invitationId).success) return null;
    const [row] = await db.select().from(invitations).where(eq(invitations.id, invitationId));
    if (!row) return null;
    const byToken = !!access.editToken && hashToken(access.editToken) === row.editTokenHash;
    const byOwner = !!access.userId && row.userId === access.userId;
    return byToken || byOwner ? row : null;
  }

  function isComplete(row: Invitation) {
    return getTemplate(row.templateId, row.templateVersion).dataSchema.safeParse(row.data).success;
  }

  return {
    load,
    isComplete,

    async createDraft({ templateId, ip }: { templateId: string; ip: string }) {
      const template = listTemplates().find((t) => t.meta.id === templateId);
      if (!template) return { status: "unknown_template" as const };
      if (!(await rateLimiter.allowDraftCreation(ip))) return { status: "rate_limited" as const };
      const editToken = generateToken();
      const [row] = await db
        .insert(invitations)
        .values({
          editTokenHash: hashToken(editToken),
          templateId,
          templateVersion: template.meta.version,
          data: {},
          options: template.defaultOptions,
          lastActivityAt: now(),
        })
        .returning({ id: invitations.id });
      return { status: "created" as const, invitationId: row.id, editToken };
    },

    async saveDraft(invitationId: string, access: Access, input: { data: unknown; options: unknown }): Promise<SaveResult> {
      const row = await load(invitationId, access);
      if (!row) return { status: "not_found" };
      const template = getTemplate(row.templateId, row.templateVersion);
      const data = template.dataSchema.safeParse(input.data);
      const options = template.optionsSchema.safeParse(input.options);
      if (!data.success || !options.success) {
        const issues = [...(data.error?.issues ?? []), ...(options.error?.issues ?? [])].map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }));
        return { status: "invalid", issues };
      }

      if (row.status === "paid") {
        if (row.editWindowEndsAt && !isWithinEditWindow(now(), row.editWindowEndsAt)) {
          return { status: "edit_window_closed" };
        }
        const paidNames = (row.paidCoupleNames as string[] | null) ?? [];
        const nextNames = template.facts(data.data).coupleNames;
        const unlocked = row.namesUnlockedAt !== null;
        const ok = paidNames.every((paid, i) => canChangeLockedName({ paid, next: nextNames[i] ?? "", unlocked }));
        if (!ok) return { status: "names_locked" };
      }

      await db
        .update(invitations)
        .set({ data: data.data, options: options.data, lastActivityAt: now(), updatedAt: now() })
        .where(eq(invitations.id, row.id));
      return { status: "saved" };
    },

    /** Email is entered in the checkout form; no login before paying (design §3). */
    async startCheckout(invitationId: string, access: Access, rawEmail: string) {
      const row = await load(invitationId, access);
      if (!row) return { status: "not_found" as const };
      if (row.status === "paid") return { status: "already_paid" as const };
      if (!isComplete(row)) return { status: "incomplete" as const };
      const email = normalizeEmail(rawEmail);
      if (!emailSchema.safeParse(email).success) return { status: "invalid_email" as const };

      await db.update(invitations).set({ checkoutEmail: email, updatedAt: now() }).where(eq(invitations.id, row.id));
      const checkout = await gateway.createCheckout({
        invitationId: row.id,
        amountClp: priceClp,
        email,
        returnUrl: new URL("/checkout/retorno", baseUrl).toString(),
      });
      return { status: "redirect" as const, url: checkout.redirectUrl };
    },

    /**
     * Called from the return URL and the webhook: records the payment, then (once) attaches
     * the checkout email as owner and sends the receipt with the access link.
     */
    async completeCheckout(providerRef: string) {
      await paymentService.reconcile(providerRef);
      const payment = await gateway.getPayment(providerRef);
      if (!payment) return { status: "unknown" as const };
      const [row] = await db.select().from(invitations).where(eq(invitations.id, payment.invitationId));
      if (!row) return { status: "unknown" as const };
      if (row.status !== "paid") return { status: "pending" as const, invitationId: row.id };

      if (row.userId === null && row.checkoutEmail) {
        const [user] = await db
          .insert(users)
          .values({ email: row.checkoutEmail })
          .onConflictDoUpdate({ target: users.email, set: { email: row.checkoutEmail } })
          .returning();
        const claimed = await db
          .update(invitations)
          .set({ userId: user.id, updatedAt: now() })
          .where(and(eq(invitations.id, row.id), isNull(invitations.userId)))
          .returning({ id: invitations.id });
        if (claimed.length) await auth.requestAccessLink({ email: row.checkoutEmail, ip: "server", system: true });
      }
      return { status: "paid" as const, invitationId: row.id };
    },
  };
}

export type InvitationService = ReturnType<typeof createInvitationService>;
