import { and, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { magicLinkTokens, sessions, users } from "@/db/schema";
import type { EmailSender } from "./email-sender";
import {
  ACCESS_LINK_TTL_MS,
  SESSION_TTL_MS,
  generateToken,
  hashToken,
  normalizeEmail,
} from "./tokens";

export type AccessLinkRequestResult = "sent" | "rate_limited";

export type ConsumeAccessLinkResult =
  | { status: "ok"; sessionToken: string; expiresAt: Date }
  | { status: "expired" | "used" | "invalid" };

export interface SessionUser {
  id: string;
  email: string;
}

/** Rate-limit hook (design §7); enforced by the rate-limit module in T11. */
export type AllowAccessLinkEmail = (input: { email: string; ip: string }) => Promise<boolean>;

export interface AuthService {
  requestAccessLink(input: { email: string; ip: string }): Promise<AccessLinkRequestResult>;
  consumeAccessLink(token: string): Promise<ConsumeAccessLinkResult>;
  getSessionUser(sessionToken: string): Promise<SessionUser | null>;
  signOut(sessionToken: string): Promise<void>;
}

export function createAuthService({
  db,
  email,
  baseUrl,
  now = () => new Date(),
  allowAccessLinkEmail = async () => true,
}: {
  db: Database;
  email: EmailSender;
  baseUrl: string;
  now?: () => Date;
  allowAccessLinkEmail?: AllowAccessLinkEmail;
}): AuthService {
  return {
    async requestAccessLink(input) {
      const address = normalizeEmail(input.email);
      if (!(await allowAccessLinkEmail({ email: address, ip: input.ip }))) return "rate_limited";

      const token = generateToken();
      await db.insert(magicLinkTokens).values({
        tokenHash: hashToken(token),
        email: address,
        expiresAt: new Date(now().getTime() + ACCESS_LINK_TTL_MS),
      });

      const link = new URL("/auth/access", baseUrl);
      link.searchParams.set("token", token);
      await email.send({
        to: address,
        subject: "Tu enlace de acceso",
        text: `Usa este enlace para entrar (vence en 15 minutos y sirve una sola vez): ${link}`,
      });
      return "sent";
    },

    async consumeAccessLink(token) {
      const tokenHash = hashToken(token);
      const at = now();
      return db.transaction(async (tx) => {
        // Atomic claim: only one concurrent caller can set used_at.
        const [claimed] = await tx
          .update(magicLinkTokens)
          .set({ usedAt: at })
          .where(
            and(
              eq(magicLinkTokens.tokenHash, tokenHash),
              isNull(magicLinkTokens.usedAt),
              gt(magicLinkTokens.expiresAt, at),
            ),
          )
          .returning();

        if (!claimed) {
          const [link] = await tx
            .select()
            .from(magicLinkTokens)
            .where(eq(magicLinkTokens.tokenHash, tokenHash));
          if (!link) return { status: "invalid" as const };
          return { status: link.usedAt ? ("used" as const) : ("expired" as const) };
        }

        const [user] = await tx
          .insert(users)
          .values({ email: claimed.email })
          .onConflictDoUpdate({ target: users.email, set: { email: claimed.email } })
          .returning();

        const sessionToken = generateToken();
        const expiresAt = new Date(at.getTime() + SESSION_TTL_MS);
        await tx
          .insert(sessions)
          .values({ idHash: hashToken(sessionToken), userId: user.id, expiresAt });
        return { status: "ok" as const, sessionToken, expiresAt };
      });
    },

    async getSessionUser(sessionToken) {
      const [row] = await db
        .select({ id: users.id, email: users.email })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(and(eq(sessions.idHash, hashToken(sessionToken)), gt(sessions.expiresAt, now())));
      return row ?? null;
    },

    async signOut(sessionToken) {
      await db.delete(sessions).where(eq(sessions.idHash, hashToken(sessionToken)));
    },
  };
}
