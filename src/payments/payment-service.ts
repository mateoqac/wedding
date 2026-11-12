import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { invitations, payments } from "@/db/schema";
import { computeEditWindowEnd } from "@/invitations/edit-window";
import { getInvitationFacts } from "@/templates/registry";
import type { GatewayPayment, PaymentGateway, WebhookRequest } from "./payment-gateway";
import { deriveInvitationStatus, nextPaymentStatus } from "./payment-status";

export type WebhookResult = "processed" | "rejected";

export interface PaymentService {
  /** Verifies the webhook, then reads the payment from the gateway; the body is never trusted. */
  handleWebhook(request: WebhookRequest): Promise<WebhookResult>;
  /** Queries the gateway directly (return URL, reconciliation job) and records the result. */
  reconcile(providerRef: string): Promise<void>;
}

export function createPaymentService({
  db,
  gateway,
  now = () => new Date(),
}: {
  db: Database;
  gateway: PaymentGateway;
  now?: () => Date;
}): PaymentService {
  async function reconcile(providerRef: string) {
    const payment = await gateway.getPayment(providerRef);
    if (!payment) throw new Error(`Payment ${providerRef} not found at ${gateway.provider}`);
    await record(payment);
  }

  /**
   * Records the gateway state and refreshes the cached invitation status in the same
   * transaction (design §4). Locking the invitation row serializes concurrent webhooks.
   */
  async function record(payment: GatewayPayment) {
    await db.transaction(async (tx) => {
      const [invitation] = await tx
        .select()
        .from(invitations)
        .where(eq(invitations.id, payment.invitationId))
        .for("update");
      if (!invitation) throw new Error(`Invitation ${payment.invitationId} not found`);

      const [existing] = await tx
        .select()
        .from(payments)
        .where(eq(payments.providerRef, payment.providerRef));
      const status = nextPaymentStatus(existing?.status, payment.status);

      if (existing) {
        await tx
          .update(payments)
          .set({ status, rawPayload: payment.raw, updatedAt: now() })
          .where(eq(payments.id, existing.id));
      } else {
        await tx.insert(payments).values({
          invitationId: payment.invitationId,
          provider: gateway.provider,
          providerRef: payment.providerRef,
          amountClp: payment.amountClp,
          status,
          rawPayload: payment.raw,
        });
      }

      const rows = await tx
        .select({ status: payments.status })
        .from(payments)
        .where(eq(payments.invitationId, invitation.id));
      const invitationStatus = deriveInvitationStatus(rows.map((row) => row.status));
      const isFirstPayment = invitationStatus === "paid" && invitation.paidCoupleNames === null;
      const facts = isFirstPayment
        ? getInvitationFacts(invitation.templateId, invitation.templateVersion, invitation.data)
        : null;

      await tx
        .update(invitations)
        .set({
          status: invitationStatus,
          updatedAt: now(),
          ...(facts && {
            paidCoupleNames: facts.coupleNames,
            editWindowEndsAt: computeEditWindowEnd({
              paidAt: now(),
              weddingDate: facts.weddingDate,
            }),
          }),
        })
        .where(eq(invitations.id, invitation.id));
    });
  }

  return {
    async handleWebhook(request) {
      const providerRef = await gateway.verifyWebhook(request);
      if (!providerRef) return "rejected";
      await reconcile(providerRef);
      return "processed";
    },
    reconcile,
  };
}
