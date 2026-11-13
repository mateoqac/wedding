import { getSharedRenderer } from "./browser";
import { InvalidRenderInputError, type RenderInput } from "./document";
import { createPreviewCache } from "./preview-cache";
import type { RenderClient, RenderClientResult } from "./render-client";
import { PoolFullError, type Renderer } from "./renderer";

/**
 * Renders inside the web process instead of calling a render service over HTTP
 * (serverless deployments, vercel-demo). Same results as the HTTP client.
 */
export function createInProcessRenderClient({
  mode,
  renderer = getSharedRenderer,
}: {
  mode: "preview" | "export";
  renderer?: () => Promise<Renderer>;
}): RenderClient {
  const cache = createPreviewCache(100);
  return {
    async render(request: RenderInput & { sequence?: number }): Promise<RenderClientResult> {
      const { sequence: _sequence, ...input } = request;
      try {
        const r = await renderer();
        const result =
          mode === "preview" ? await cache.getOrRender(input, (i) => r.renderPreview(i)) : await r.renderExport(input);
        return { status: "ok", body: result.body, contentType: result.contentType, overflow: result.overflow };
      } catch (error) {
        if (error instanceof PoolFullError) return { status: "busy", retryAfterSeconds: 2 };
        if (error instanceof InvalidRenderInputError) return { status: "invalid" };
        console.error("in-process render failed", error);
        return { status: "failed", httpStatus: 500 };
      }
    },
  };
}
