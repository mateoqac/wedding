import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { PgBoss } from "pg-boss";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invitations, exports as exportsTable } from "@/db/schema";
import { createExportService, type ExportService } from "@/exports/export-service";
import { EXPORT_QUEUE, createExportQueue } from "@/exports/queue";
import { createLocalStorage } from "@/exports/local-storage";
import type { RenderClient } from "@/render/render-client";
import { fixtures } from "@/templates/clasico-marco-doble/v1/fixtures";
import { defaultOptions } from "@/templates/clasico-marco-doble/v1/options";
import { createTestDatabase } from "./test-database";

let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
let boss: PgBoss;
let dir: string;
let service: ExportService;
let renders: number;
let failNext: number;

const renderClient: RenderClient = {
  async render(input) {
    renders++;
    if (failNext > 0) {
      failNext--;
      return { status: "failed", httpStatus: 500 };
    }
    return { status: "ok", body: Buffer.from(`file:${input.format}`), contentType: "application/pdf", overflow: false };
  },
};

async function insertInvitation(status: "draft" | "paid") {
  const [row] = await testDb.db
    .insert(invitations)
    .values({
      editTokenHash: `token-${crypto.randomUUID()}`,
      templateId: "clasico-marco-doble",
      templateVersion: 1,
      data: fixtures.typical,
      options: defaultOptions,
      status,
    })
    .returning();
  return row.id;
}

async function waitFor<T>(check: () => Promise<T | undefined>, timeoutMs = 20_000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await check();
    if (value !== undefined) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("timed out");
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  boss = new PgBoss({ connectionString: testDb.url });
  boss.on("error", () => {});
  await boss.start();
  await createExportQueue(boss, { retryDelaySeconds: 1 });
});

afterAll(async () => {
  await boss.stop({ graceful: false });
  await testDb.drop();
});

beforeEach(async () => {
  renders = 0;
  failNext = 0;
  dir = await mkdtemp(join(tmpdir(), "wi-exports-"));
  service = createExportService({
    db: testDb.db,
    boss,
    renderClient,
    storage: createLocalStorage({ directory: dir, signingSecret: "s", baseUrl: "https://partes.example" }),
  });
  return () => rm(dir, { recursive: true, force: true });
});

describe("export pipeline", () => {
  it("refuses exports of unpaid invitations without enqueueing", async () => {
    const id = await insertInvitation("draft");
    expect(await service.requestExport({ invitationId: id, format: "png" })).toEqual({ status: "not_paid" });
    expect(renders).toBe(0);
    expect(await testDb.db.select().from(exportsTable).where(eq(exportsTable.invitationId, id))).toHaveLength(0);
    expect(EXPORT_QUEUE).toBe("export");
  });

  it("enqueues once per invitation, format and content hash", async () => {
    const id = await insertInvitation("paid");
    const first = await service.requestExport({ invitationId: id, format: "png" });
    const second = await service.requestExport({ invitationId: id, format: "png" });
    expect(first.status).toBe("queued");
    expect(second.status).toBe("queued");
    if (first.status !== "queued" || second.status !== "queued") return;
    expect(first.jobId).not.toBeNull();
    expect(second.jobId).toBeNull();
  });

  it("renders, stores the file and records the export; later requests return the cached file", async () => {
    const id = await insertInvitation("paid");
    await service.startWorker();
    await service.requestExport({ invitationId: id, format: "print-pdf" });

    const row = await waitFor(async () => {
      const [r] = await testDb.db.select().from(exportsTable).where(eq(exportsTable.invitationId, id));
      return r;
    });
    expect(row.r2Key).toBe(`exports/${id}/print-pdf-${row.contentHash}.pdf`);
    expect((await readFile(join(dir, row.r2Key))).toString()).toBe("file:print-pdf");

    const rendersBefore = renders;
    const ready = await service.requestExport({ invitationId: id, format: "print-pdf" });
    expect(ready.status).toBe("ready");
    if (ready.status === "ready") expect(ready.url).toMatch(/^https:\/\/partes\.example\/files\/exports\//);
    expect(renders).toBe(rendersBefore);
  });

  it("retries a failed render and still records exactly one export", async () => {
    const id = await insertInvitation("paid");
    failNext = 1;
    await service.startWorker();
    await service.requestExport({ invitationId: id, format: "story" });

    await waitFor(async () => {
      const rows = await testDb.db.select().from(exportsTable).where(eq(exportsTable.invitationId, id));
      return rows.length ? rows : undefined;
    });
    // A retry of the same singleton job must not be blocked by its own key, nor duplicate rows.
    const again = await service.requestExport({ invitationId: id, format: "story" });
    expect(again.status).toBe("ready");
    const rows = await testDb.db.select().from(exportsTable).where(eq(exportsTable.invitationId, id));
    expect(rows).toHaveLength(1);
    expect(renders).toBe(2);
  });

  it("reports rate limiting from the hook without enqueueing", async () => {
    const id = await insertInvitation("paid");
    const limited = createExportService({
      db: testDb.db,
      boss,
      renderClient,
      storage: createLocalStorage({ directory: dir, signingSecret: "s", baseUrl: "https://partes.example" }),
      allowExportEnqueue: async () => false,
    });
    expect(await limited.requestExport({ invitationId: id, format: "jpg" })).toEqual({ status: "rate_limited" });
  });
});
