import type { RenderInput } from "./document";

export type RenderClientResult =
  | { status: "ok"; body: Buffer; contentType: string; overflow: boolean }
  | { status: "busy"; retryAfterSeconds: number }
  | { status: "invalid" }
  | { status: "failed"; httpStatus: number };

/** HTTP client the web app uses to call a render service (preview or export). */
export function createRenderClient({ baseUrl, secret }: { baseUrl: string; secret: string }) {
  return {
    async render(input: RenderInput & { sequence?: number }, signal?: AbortSignal): Promise<RenderClientResult> {
      const response = await fetch(new URL("/render", baseUrl), {
        method: "POST",
        headers: { "content-type": "application/json", "x-worker-secret": secret },
        body: JSON.stringify(input),
        signal,
      });
      if (response.status === 200) {
        return {
          status: "ok",
          body: Buffer.from(await response.arrayBuffer()),
          contentType: response.headers.get("content-type") ?? "application/octet-stream",
          overflow: response.headers.get("x-overflow") === "true",
        };
      }
      if (response.status === 503) {
        return { status: "busy", retryAfterSeconds: Number(response.headers.get("retry-after") ?? 2) };
      }
      if (response.status === 422) return { status: "invalid" };
      return { status: "failed", httpStatus: response.status };
    },
  };
}

export type RenderClient = ReturnType<typeof createRenderClient>;
