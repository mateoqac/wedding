import { afterAll, describe, expect, it } from "vitest";
import { closeSharedBrowser } from "@/render/browser";
import { createInProcessRenderClient } from "@/render/in-process-client";
import { PoolFullError, type Renderer } from "@/render/renderer";
import { fixtures } from "@/templates/clasico-marco-doble/v1/fixtures";
import { defaultOptions } from "@/templates/clasico-marco-doble/v1/options";

const input = { templateId: "clasico-marco-doble", templateVersion: 1, data: fixtures.typical, options: defaultOptions, format: "png" as const };

afterAll(async () => {
  await closeSharedBrowser();
});

// Same contract as the HTTP render client, so the app can swap transports (vercel-demo, V1).
describe("in-process render client", () => {
  it("renders previews and exports with a lazily launched shared browser", async () => {
    const preview = createInProcessRenderClient({ mode: "preview" });
    const exporter = createInProcessRenderClient({ mode: "export" });
    const p = await preview.render(input);
    expect(p.status).toBe("ok");
    if (p.status === "ok") expect(p.contentType).toBe("image/jpeg");
    const e = await exporter.render({ ...input, format: "print-pdf" });
    expect(e.status).toBe("ok");
    if (e.status === "ok") expect(e.body.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("maps invalid data to invalid and a full pool to busy", async () => {
    const client = createInProcessRenderClient({ mode: "preview" });
    expect(await client.render({ ...input, data: { couple: {} } })).toEqual({ status: "invalid" });

    const busyRenderer = { renderPreview: async () => { throw new PoolFullError(); } } as unknown as Renderer;
    const busy = createInProcessRenderClient({ mode: "preview", renderer: async () => busyRenderer });
    expect(await busy.render(input)).toEqual({ status: "busy", retryAfterSeconds: 2 });
  });
});
