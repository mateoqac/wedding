import type { Browser } from "playwright-core";
import { createRenderer, type Renderer } from "./renderer";

/** True on Vercel (or when forced): use the serverless Chromium build instead of Playwright's. */
const useServerlessChromium = () => !!process.env.VERCEL || process.env.SERVERLESS_CHROMIUM === "1";

async function launch(): Promise<Browser> {
  if (useServerlessChromium()) {
    const [{ chromium }, { default: Chromium }] = await Promise.all([
      import("playwright-core"),
      import("@sparticuz/chromium"),
    ]);
    return chromium.launch({ executablePath: await Chromium.executablePath(), args: Chromium.args, headless: true });
  }
  const { chromium } = await import("playwright");
  return chromium.launch() as unknown as Promise<Browser>;
}

let shared: Promise<{ browser: Browser; renderer: Renderer }> | undefined;

/**
 * One browser per process, launched on first use and reused across requests (a warm
 * serverless instance keeps it). A crashed browser is replaced on the next call.
 */
export function getSharedRenderer(): Promise<Renderer> {
  if (!shared) {
    shared = launch().then((browser) => {
      browser.on("disconnected", () => {
        shared = undefined;
      });
      const renderer = createRenderer({
        browser: browser as never,
        poolSize: Number(process.env.RENDER_POOL_SIZE ?? 2),
        queueLimit: Number(process.env.RENDER_QUEUE_LIMIT ?? 4),
        timeoutMs: Number(process.env.RENDER_TIMEOUT_MS ?? 20_000),
      });
      return { browser, renderer };
    });
    shared.catch(() => {
      shared = undefined;
    });
  }
  return shared.then((s) => s.renderer);
}

export async function closeSharedBrowser() {
  const current = shared;
  shared = undefined;
  if (current) await (await current).browser.close();
}
