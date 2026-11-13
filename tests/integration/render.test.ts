import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RenderInput } from "@/render/document";
import { createPreviewCache } from "@/render/preview-cache";
import { PoolFullError, createRenderer, type Renderer } from "@/render/renderer";
import { startRenderServer } from "@/render/server";
import { fixtures } from "@/templates/clasico-marco-doble/v1/fixtures";
import { defaultOptions } from "@/templates/clasico-marco-doble/v1/options";

let browser: Browser;
let renderer: Renderer;

const input = (format: "print-pdf" | "digital-pdf" | "png" | "jpg" | "story" = "png") => ({
  templateId: "clasico-marco-doble",
  templateVersion: 1,
  data: fixtures.typical,
  options: defaultOptions,
  format,
});

function imageSize(buffer: Buffer) {
  if (buffer[0] === 0x89) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  // JPEG: scan for SOF0/SOF2 marker.
  let i = 2;
  while (i < buffer.length) {
    const marker = buffer[i + 1];
    const length = buffer.readUInt16BE(i + 2);
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  throw new Error("no SOF marker");
}

beforeAll(async () => {
  browser = await chromium.launch();
  renderer = createRenderer({ browser, poolSize: 2, queueLimit: 1, timeoutMs: 15_000 });
});

afterAll(async () => {
  await browser.close();
});

describe("renderer", () => {
  it("renders a watermarked JPEG preview with a 1000 px long side", async () => {
    const result = await renderer.renderPreview(input("png"));
    expect(result.contentType).toBe("image/jpeg");
    const size = imageSize(result.body);
    expect(Math.max(size.width, size.height)).toBe(1000);
    expect(result.overflow).toBe(false);
  });

  it("renders the story preview in portrait", async () => {
    const size = imageSize((await renderer.renderPreview(input("story"))).body);
    expect(size).toEqual({ width: 563, height: 1000 });
  });

  it("exports PDFs, full-resolution PNG/JPG and story images", async () => {
    const print = await renderer.renderExport(input("print-pdf"));
    expect(print.contentType).toBe("application/pdf");
    expect(print.body.subarray(0, 5).toString()).toBe("%PDF-");
    const png = await renderer.renderExport(input("png"));
    expect(imageSize(png.body)).toEqual({ width: 2480, height: 1772 });
    const jpg = await renderer.renderExport(input("jpg"));
    expect(jpg.contentType).toBe("image/jpeg");
    expect(imageSize(jpg.body)).toEqual({ width: 2480, height: 1772 });
    const story = await renderer.renderExport(input("story"));
    expect(imageSize(story.body)).toEqual({ width: 1080, height: 1920 });
  });

  it("exports tagged PDFs with a title and Spanish language for screen readers", async () => {
    const pdf = (await renderer.renderExport(input("digital-pdf"))).body.toString("latin1");
    expect(pdf).toContain("/StructTreeRoot");
    expect(pdf).toMatch(/\/Lang\s*\(es/);
    expect(pdf).toContain("/Title");
  });

  it("blocks every external request from the page", async () => {
    const result = await renderer.renderHtml(
      '<img src="https://example.com/x.png"><link rel="stylesheet" href="http://example.com/a.css">',
      { width: 200, height: 100 },
    );
    expect(result.blockedRequests.sort()).toEqual(["http://example.com/a.css", "https://example.com/x.png"]);
  });

  it("rejects work beyond the pool and its wait queue", async () => {
    const jobs = Array.from({ length: 4 }, () => renderer.renderPreview(input("png")));
    const results = await Promise.allSettled(jobs);
    expect(results.filter((r) => r.status === "rejected" && r.reason instanceof PoolFullError)).toHaveLength(1);
  });

  it("serves previews from the cache without rendering again", async () => {
    let renders = 0;
    const cache = createPreviewCache(10);
    const counting = { ...renderer, renderPreview: async (i: RenderInput) => { renders++; return renderer.renderPreview(i); } };
    const a = await cache.getOrRender(input("png"), counting.renderPreview);
    const b = await cache.getOrRender(input("png"), counting.renderPreview);
    expect(renders).toBe(1);
    expect(b.body.equals(a.body)).toBe(true);
  });
});

describe("render server", () => {
  it("requires the shared secret and answers 503 with Retry-After when saturated", async () => {
    const busy: Renderer = {
      ...renderer,
      renderPreview: async () => { throw new PoolFullError(); },
    };
    const server = await startRenderServer({ mode: "preview", renderer: busy, secret: "s3cret", port: 0 });
    const url = `http://127.0.0.1:${server.port}/render`;
    const body = JSON.stringify({ ...input("png"), sequence: 7 });

    const unauthorized = await fetch(url, { method: "POST", body });
    expect(unauthorized.status).toBe(401);

    const saturated = await fetch(url, { method: "POST", body, headers: { "x-worker-secret": "s3cret" } });
    expect(saturated.status).toBe(503);
    expect(saturated.headers.get("retry-after")).toBe("2");
    await server.close();
  });

  it("returns the preview with its sequence number", async () => {
    const server = await startRenderServer({ mode: "preview", renderer, secret: "s3cret", port: 0 });
    const response = await fetch(`http://127.0.0.1:${server.port}/render`, {
      method: "POST",
      body: JSON.stringify({ ...input("png"), sequence: 7 }),
      headers: { "x-worker-secret": "s3cret" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("x-sequence")).toBe("7");
    await server.close();
  });

  it("rejects invalid invitation data with 422", async () => {
    const server = await startRenderServer({ mode: "preview", renderer, secret: "s3cret", port: 0 });
    const response = await fetch(`http://127.0.0.1:${server.port}/render`, {
      method: "POST",
      body: JSON.stringify({ ...input("png"), data: { couple: {} }, sequence: 1 }),
      headers: { "x-worker-secret": "s3cret" },
    });
    expect(response.status).toBe(422);
    await server.close();
  });
});
