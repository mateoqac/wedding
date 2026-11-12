import { and, eq } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import type { Database } from "@/db/client";
import { exports as exportsTable, invitations } from "@/db/schema";
import { contentHash } from "@/invitations/content-hash";
import type { Format } from "@/invitations/formats";
import type { RenderClient } from "@/render/render-client";
import { EXPORT_QUEUE, exportSingletonKey } from "./queue";
import { exportKey, type FileStorage } from "./storage";

export type ExportRequestResult =
  | { status: "ready"; url: string }
  | { status: "queued"; jobId: string | null }
  | { status: "not_paid" }
  | { status: "not_found" }
  | { status: "rate_limited" };

interface ExportJob {
  invitationId: string;
  format: Format;
  contentHash: string;
}

const EXTENSIONS: Record<Format, string> = {
  "print-pdf": "pdf",
  "digital-pdf": "pdf",
  png: "png",
  jpg: "jpg",
  story: "png",
};

export interface ExportService {
  /** Ownership is checked by the caller (session or edit token); this checks `paid` (design §7). */
  requestExport(input: { invitationId: string; format: Format }): Promise<ExportRequestResult>;
  startWorker(): Promise<void>;
}

export function createExportService({
  db,
  boss,
  renderClient,
  storage,
  allowExportEnqueue = async () => true,
}: {
  db: Database;
  boss: PgBoss;
  renderClient: RenderClient;
  storage: FileStorage;
  allowExportEnqueue?: (invitationId: string) => Promise<boolean>;
}): ExportService {
  let workerStarted = false;

  async function loadInvitation(invitationId: string) {
    const [row] = await db.select().from(invitations).where(eq(invitations.id, invitationId));
    return row;
  }

  function hashOf(invitation: NonNullable<Awaited<ReturnType<typeof loadInvitation>>>, format: Format) {
    return contentHash({
      templateId: invitation.templateId,
      templateVersion: invitation.templateVersion,
      format,
      data: invitation.data,
      options: invitation.options,
    });
  }

  async function findExport(invitationId: string, format: Format, hash: string) {
    const [row] = await db
      .select()
      .from(exportsTable)
      .where(
        and(
          eq(exportsTable.invitationId, invitationId),
          eq(exportsTable.format, format),
          eq(exportsTable.contentHash, hash),
        ),
      );
    return row;
  }

  async function runJob(job: ExportJob) {
    const invitation = await loadInvitation(job.invitationId);
    if (!invitation || invitation.status !== "paid") return; // refunded meanwhile: nothing to do
    const hash = hashOf(invitation, job.format);
    if (hash !== job.contentHash) return; // content changed; a newer job owns the new hash
    if (await findExport(job.invitationId, job.format, hash)) return;

    const result = await renderClient.render({
      templateId: invitation.templateId,
      templateVersion: invitation.templateVersion,
      data: invitation.data,
      options: invitation.options,
      format: job.format,
    });
    if (result.status !== "ok") throw new Error(`Render failed: ${result.status}`); // pg-boss retries

    const key = exportKey(job.invitationId, job.format, hash, EXTENSIONS[job.format]);
    await storage.put(key, result.body, result.contentType);
    await db
      .insert(exportsTable)
      .values({ invitationId: job.invitationId, format: job.format, contentHash: hash, r2Key: key })
      .onConflictDoNothing();
  }

  return {
    async requestExport({ invitationId, format }) {
      const invitation = await loadInvitation(invitationId);
      if (!invitation) return { status: "not_found" };
      if (invitation.status !== "paid") return { status: "not_paid" };

      const hash = hashOf(invitation, format);
      const existing = await findExport(invitationId, format, hash);
      if (existing) return { status: "ready", url: await storage.signedUrl(existing.r2Key) };

      if (!(await allowExportEnqueue(invitationId))) return { status: "rate_limited" };
      const job: ExportJob = { invitationId, format, contentHash: hash };
      const jobId = await boss.send(EXPORT_QUEUE, job, {
        singletonKey: exportSingletonKey(invitationId, format, hash),
      });
      return { status: "queued", jobId };
    },

    async startWorker() {
      if (workerStarted) return;
      workerStarted = true;
      await boss.work<ExportJob>(EXPORT_QUEUE, { pollingIntervalSeconds: 0.5 }, async (jobs) => {
        for (const job of jobs) await runJob(job.data);
      });
    },
  };
}
