import { sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { rateLimits } from "@/db/schema";

const WINDOW_MS = 60 * 60 * 1000;

/** Fixed one-hour windows (decision D8). */
export const LIMITS = {
  accessLinkPerEmail: 5,
  accessLinkPerIp: 20,
  draftPerIp: 20,
  previewPerDraft: 600,
  exportPerInvitation: 30,
} as const;

/** Postgres-backed fixed-window rate limiter (design §7). */
export function createRateLimiter({ db, now = () => new Date() }: { db: Database; now?: () => Date }) {
  /** Counts one hit atomically; returns false when the window is already at its limit. */
  async function hit(key: string, limit: number): Promise<boolean> {
    const windowStart = new Date(Math.floor(now().getTime() / WINDOW_MS) * WINDOW_MS);
    const [row] = await db
      .insert(rateLimits)
      .values({ key, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: [rateLimits.key, rateLimits.windowStart],
        set: { count: sql`${rateLimits.count} + 1` },
      })
      .returning({ count: rateLimits.count });
    return row.count <= limit;
  }

  return {
    hit,
    async allowAccessLinkEmail({ email, ip }: { email: string; ip: string }) {
      const byEmail = await hit(`access:email:${email}`, LIMITS.accessLinkPerEmail);
      const byIp = await hit(`access:ip:${ip}`, LIMITS.accessLinkPerIp);
      return byEmail && byIp;
    },
    allowDraftCreation: (ip: string) => hit(`draft:ip:${ip}`, LIMITS.draftPerIp),
    allowPreview: (invitationId: string) => hit(`preview:invitation:${invitationId}`, LIMITS.previewPerDraft),
    allowExportEnqueue: (invitationId: string) => hit(`export:invitation:${invitationId}`, LIMITS.exportPerInvitation),
    /** Drops windows older than one day so the table stays small. */
    async purgeOldWindows() {
      await db.delete(rateLimits).where(sql`${rateLimits.windowStart} < ${new Date(now().getTime() - 24 * WINDOW_MS)}`);
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
