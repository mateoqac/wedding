import type { Browser, Page } from "playwright";
import { buildDocument, type RenderInput } from "./document";

export class PoolFullError extends Error {
  constructor() {
    super("Render pool and wait queue are full");
  }
}

export interface RenderResult {
  body: Buffer;
  contentType: "image/jpeg" | "image/png" | "application/pdf";
  extension: "jpg" | "png" | "pdf";
  /** True when the content does not fit its frame (design §5 text fitting). */
  overflow: boolean;
}

export interface Renderer {
  renderPreview(input: RenderInput): Promise<RenderResult>;
  renderExport(input: RenderInput): Promise<RenderResult>;
  renderHtml(html: string, size: { width: number; height: number }): Promise<{ blockedRequests: string[] }>;
}

const PREVIEW_LONG_SIDE = 1000;
const PREVIEW_QUALITY = 70;

/** Bounded pool of pages; at most `queueLimit` callers wait, the rest fail fast (D2). */
class PagePool {
  private idle: Page[] = [];
  private created = 0;
  private waiters: ((page: Page) => void)[] = [];

  constructor(
    private browser: Browser,
    private size: number,
    private queueLimit: number,
  ) {}

  async acquire(): Promise<Page> {
    const page = this.idle.pop();
    if (page) return page;
    if (this.created < this.size) {
      this.created++;
      try {
        return await this.browser.newPage();
      } catch (error) {
        this.created--;
        throw error;
      }
    }
    if (this.waiters.length >= this.queueLimit) throw new PoolFullError();
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  release(page: Page, broken: boolean) {
    if (broken) {
      this.created--;
      void page.close().catch(() => {});
      const waiter = this.waiters.shift();
      if (waiter) this.acquire().then(waiter, () => this.waiters.unshift(waiter));
      return;
    }
    const waiter = this.waiters.shift();
    if (waiter) waiter(page);
    else this.idle.push(page);
  }
}

export function createRenderer({
  browser,
  poolSize = 4,
  queueLimit = 8,
  timeoutMs = 15_000,
}: {
  browser: Browser;
  poolSize?: number;
  queueLimit?: number;
  timeoutMs?: number;
}): Renderer {
  const pool = new PagePool(browser, poolSize, queueLimit);

  async function withPage<T>(html: string, size: { width: number; height: number }, work: (page: Page) => Promise<T>) {
    const page = await pool.acquire();
    const blockedRequests: string[] = [];
    let broken = false;
    try {
      page.setDefaultTimeout(timeoutMs);
      await page.unroute("**/*").catch(() => {});
      await page.route("**/*", (route) => {
        const url = route.request().url();
        if (url.startsWith("data:") || url.startsWith("about:")) return route.continue();
        blockedRequests.push(url);
        return route.abort("blockedbyclient");
      });
      await page.setViewportSize(size);
      await page.setContent(html, { waitUntil: "load", timeout: timeoutMs });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const result = await work(page);
      return { result, blockedRequests };
    } catch (error) {
      broken = true;
      throw error;
    } finally {
      pool.release(page, broken);
    }
  }

  async function overflowOf(page: Page) {
    return page.evaluate(() => {
      const frame = document.querySelector(".frame");
      return !!frame && frame.scrollHeight > frame.clientHeight + 1;
    });
  }

  return {
    async renderPreview(input) {
      const { html, size } = await buildDocument(input, { watermark: true });
      const zoom = PREVIEW_LONG_SIDE / Math.max(size.width, size.height);
      const scaled = { width: Math.round(size.width * zoom), height: Math.round(size.height * zoom) };
      const zoomed = html.replace("</style>", `html{zoom:${zoom}}</style>`);
      const { result } = await withPage(zoomed, scaled, async (page) => ({
        body: await page.screenshot({ type: "jpeg", quality: PREVIEW_QUALITY, clip: { x: 0, y: 0, ...scaled } }),
        overflow: await overflowOf(page),
      }));
      return { ...result, contentType: "image/jpeg", extension: "jpg" };
    },

    async renderExport(input) {
      const { html, size, geometry } = await buildDocument(input, { watermark: false });
      const { result } = await withPage(html, size, async (page) => {
        const overflow = await overflowOf(page);
        if (geometry.unit === "mm") {
          const body = await page.pdf({
            width: `${geometry.width}mm`,
            height: `${geometry.height}mm`,
            printBackground: true,
            preferCSSPageSize: true,
          });
          return { body, overflow, contentType: "application/pdf" as const, extension: "pdf" as const };
        }
        const jpeg = input.format === "jpg";
        const body = await page.screenshot({
          type: jpeg ? "jpeg" : "png",
          ...(jpeg ? { quality: 92 } : {}),
          clip: { x: 0, y: 0, ...size },
        });
        return jpeg
          ? { body, overflow, contentType: "image/jpeg" as const, extension: "jpg" as const }
          : { body, overflow, contentType: "image/png" as const, extension: "png" as const };
      });
      return result;
    },

    async renderHtml(html, size) {
      const { blockedRequests } = await withPage(html, size, async () => undefined);
      return { blockedRequests };
    },
  };
}
