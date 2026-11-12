import type { PgBoss } from "pg-boss";

export const EXPORT_QUEUE = "export";

/**
 * Export queue (D7): `exclusive` so the singletonKey deduplicates queued, active and retrying
 * jobs; 3 attempts with exponential backoff; a stuck render expires after 2 minutes.
 */
export async function createExportQueue(boss: PgBoss, { retryDelaySeconds = 10 } = {}) {
  await boss.createQueue(EXPORT_QUEUE, {
    policy: "exclusive",
    retryLimit: 2,
    retryDelay: retryDelaySeconds,
    retryBackoff: true,
    expireInSeconds: 120,
  });
}

export function exportSingletonKey(invitationId: string, format: string, contentHash: string) {
  return `${invitationId}:${format}:${contentHash}`;
}
