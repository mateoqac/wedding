import { chromium } from "playwright";
import { createRenderer } from "./renderer";
import { startRenderServer } from "./server";

/** Entry point of the render worker image; RENDER_MODE selects preview or export (design §5). */
async function main() {
  const mode = process.env.RENDER_MODE === "export" ? "export" : "preview";
  const secret = process.env.WORKER_SECRET;
  if (!secret) throw new Error("WORKER_SECRET is required");

  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
  const renderer = createRenderer({
    browser,
    poolSize: Number(process.env.RENDER_POOL_SIZE ?? 4),
    queueLimit: Number(process.env.RENDER_QUEUE_LIMIT ?? 8),
    timeoutMs: Number(process.env.RENDER_TIMEOUT_MS ?? 15_000),
  });
  const server = await startRenderServer({
    mode,
    renderer,
    secret,
    port: Number(process.env.PORT ?? 4100),
    host: process.env.HOST ?? "0.0.0.0",
  });
  console.log(`render ${mode} worker listening on ${server.port}`);

  const shutdown = async () => {
    await server.close();
    await browser.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
