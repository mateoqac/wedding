import { and, eq, isNull, lte, notExists, sql } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import type { Database } from "@/db/client";
import { invitations, payments } from "@/db/schema";

export const DRAFT_TTL_DAYS = 30;
export const CLEANUP_QUEUE = "cleanup-drafts";

/**
 * Deletes anonymous drafts with no activity for 30 days (design §6). Never touches paid
 * invitations, owned invitations, or any invitation that has a payment row.
 */
export async function cleanupAnonymousDrafts(db: Database, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(invitations)
    .where(
      and(
        isNull(invitations.userId),
        eq(invitations.status, "draft"),
        lte(invitations.lastActivityAt, cutoff),
        notExists(db.select({ one: sql`1` }).from(payments).where(eq(payments.invitationId, invitations.id))),
      ),
    )
    .returning({ id: invitations.id });
  return deleted.length;
}

/** Schedules the daily cleanup cron (D7: 03:00 America/Santiago) and its worker. */
export async function scheduleDraftCleanup(boss: PgBoss, db: Database) {
  await boss.createQueue(CLEANUP_QUEUE);
  await boss.schedule(CLEANUP_QUEUE, "0 3 * * *", null, { tz: "America/Santiago" });
  await boss.work(CLEANUP_QUEUE, async () => {
    const count = await cleanupAnonymousDrafts(db);
    console.log(`cleanup-drafts deleted ${count} drafts`);
  });
}
