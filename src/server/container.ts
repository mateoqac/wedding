import { PgBoss } from "pg-boss";
import { createAuthService } from "@/auth/auth-service";
import type { EmailSender } from "@/auth/email-sender";
import { FileOutboxEmailSender } from "@/auth/file-outbox-email-sender";
import { ResendEmailSender } from "@/auth/resend-email-sender";
import { createDatabase } from "@/db/client";
import { createExportService } from "@/exports/export-service";
import { createLocalStorage } from "@/exports/local-storage";
import { createExportQueue } from "@/exports/queue";
import { createR2Storage } from "@/exports/r2-storage";
import { scheduleDraftCleanup } from "@/invitations/draft-cleanup";
import { createInvitationService } from "@/invitations/invitation-service";
import { FakePaymentGateway } from "@/payments/fake-payment-gateway";
import type { PaymentGateway } from "@/payments/payment-gateway";
import { createPaymentService } from "@/payments/payment-service";
import { createRateLimiter } from "@/rate-limits/rate-limiter";
import { createRenderClient } from "@/render/render-client";

const env = (name: string, fallback?: string) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Missing environment variable ${name}`);
  return value;
};

function buildEmailSender(): EmailSender {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) return ResendEmailSender.fromApiKey(apiKey, env("EMAIL_FROM"));
  return new FileOutboxEmailSender(env("EMAIL_OUTBOX_DIR", ".data/outbox"));
}

function buildStorage(baseUrl: string) {
  if (process.env.R2_BUCKET) {
    return createR2Storage({
      accountId: env("R2_ACCOUNT_ID"),
      accessKeyId: env("R2_ACCESS_KEY_ID"),
      secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
      bucket: env("R2_BUCKET"),
    });
  }
  return createLocalStorage({
    directory: env("STORAGE_DIR", ".data/files"),
    signingSecret: env("FILE_SIGNING_SECRET", "dev-file-signing-secret"),
    baseUrl,
  });
}

function buildGateway(): PaymentGateway {
  const name = env("PAYMENT_GATEWAY", "fake");
  if (name === "fake") return new FakePaymentGateway(env("FAKE_GATEWAY_SECRET", "fake-secret"));
  throw new Error(`Payment gateway "${name}" has no adapter yet (design §11)`);
}

/** Composition root: wires adapters from environment variables (see README). */
function createContainer() {
  const baseUrl = env("BASE_URL", "http://localhost:4321");
  const databaseUrl = env("DATABASE_URL", "postgres://wedding:wedding@localhost:5433/wedding");
  const { db } = createDatabase(databaseUrl);
  const rateLimiter = createRateLimiter({ db });
  const email = buildEmailSender();
  const auth = createAuthService({ db, email, baseUrl, allowAccessLinkEmail: rateLimiter.allowAccessLinkEmail });
  const gateway = buildGateway();
  const paymentService = createPaymentService({ db, gateway });
  const storage = buildStorage(baseUrl);
  const workerSecret = env("WORKER_SECRET", "dev-worker-secret");
  const previewClient = createRenderClient({ baseUrl: env("PREVIEW_URL", "http://127.0.0.1:4101"), secret: workerSecret });
  const exportClient = createRenderClient({ baseUrl: env("EXPORT_URL", "http://127.0.0.1:4102"), secret: workerSecret });
  const boss = new PgBoss({ connectionString: databaseUrl });
  boss.on("error", (error) => console.error("pg-boss", error));
  const bossReady = boss.start().then(() => createExportQueue(boss)).then(() => boss);

  const invitations = createInvitationService({
    db,
    auth,
    gateway,
    paymentService,
    rateLimiter,
    baseUrl,
    priceClp: Number(env("PRICE_CLP", "9990")),
  });

  const exports = createExportService({
    db,
    boss,
    renderClient: exportClient,
    storage,
    allowExportEnqueue: rateLimiter.allowExportEnqueue,
  });
  // Background jobs run in the web process unless RUN_JOBS=false (then run them elsewhere).
  if (process.env.RUN_JOBS !== "false") {
    void bossReady
      .then(async () => {
        await exports.startWorker();
        await scheduleDraftCleanup(boss, db);
      })
      .catch((error) => console.error("failed to start background jobs", error));
  }

  return {
    baseUrl,
    db,
    auth,
    gateway,
    paymentService,
    invitations,
    rateLimiter,
    storage,
    previewClient,
    exportClient,
    boss,
    bossReady,
    priceClp: Number(env("PRICE_CLP", "9990")),
    secureCookies: baseUrl.startsWith("https://"),
    exports,
  };
}

let container: ReturnType<typeof createContainer> | undefined;

export function getContainer() {
  container ??= createContainer();
  return container;
}

export type Container = ReturnType<typeof createContainer>;
