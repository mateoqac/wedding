import { defineConfig } from "@playwright/test";

const E2E_DATABASE_URL = "postgres://wedding:wedding@localhost:5433/wedding_e2e";
const env = {
  DATABASE_URL: E2E_DATABASE_URL,
  BASE_URL: "http://localhost:4400",
  EMAIL_OUTBOX_DIR: ".data/e2e/outbox",
  STORAGE_DIR: ".data/e2e/files",
  PREVIEW_URL: "http://127.0.0.1:4401",
  EXPORT_URL: "http://127.0.0.1:4402",
  WORKER_SECRET: "e2e-worker-secret",
  PAYMENT_GATEWAY: "fake",
};

/**
 * E2E happy path (T12). Visual regression lives in playwright.visual.config.ts.
 */
export default defineConfig({
  testDir: "tests",
  testMatch: ["e2e/**/*.spec.ts"],
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: env.BASE_URL, locale: "es-CL" },
  webServer: [
    {
      command: "tsx src/render/main.ts",
      env: { ...env, RENDER_MODE: "preview", PORT: "4401", HOST: "127.0.0.1" },
      url: "http://127.0.0.1:4401/health",
      reuseExistingServer: false,
    },
    {
      command: "tsx src/render/main.ts",
      env: { ...env, RENDER_MODE: "export", PORT: "4402", HOST: "127.0.0.1" },
      url: "http://127.0.0.1:4402/health",
      reuseExistingServer: false,
    },
    {
      command: "astro dev --port 4400",
      env,
      url: "http://localhost:4400/",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
