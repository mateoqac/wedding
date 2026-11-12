import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { z } from "zod";
import { FORMATS } from "@/invitations/formats";
import { InvalidRenderInputError } from "./document";
import { createPreviewCache } from "./preview-cache";
import { PoolFullError, type Renderer } from "./renderer";

const MAX_BODY_BYTES = 256 * 1024;
const RETRY_AFTER_SECONDS = "2";

const requestSchema = z.object({
  templateId: z.string().min(1).max(100),
  templateVersion: z.number().int().positive(),
  data: z.unknown(),
  options: z.unknown(),
  format: z.enum(FORMATS),
  sequence: z.number().int().nonnegative().optional(),
});

export type RenderRequest = z.infer<typeof requestSchema>;

async function readBody(request: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function secretMatches(given: string | string[] | undefined, secret: string) {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Internal render service. Previews and exports run as two instances of this server
 * (design §5 isolation), each with its own page pool; only the web app calls it.
 */
export async function startRenderServer({
  mode,
  renderer,
  secret,
  port,
  host = "127.0.0.1",
}: {
  mode: "preview" | "export";
  renderer: Renderer;
  secret: string;
  port: number;
  host?: string;
}) {
  const cache = createPreviewCache();

  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200).end("ok");
      return;
    }
    if (request.method !== "POST" || request.url !== "/render") {
      response.writeHead(404).end();
      return;
    }
    if (!secretMatches(request.headers["x-worker-secret"], secret)) {
      response.writeHead(401).end();
      return;
    }

    let parsed: RenderRequest;
    try {
      const result = requestSchema.safeParse(JSON.parse(await readBody(request)));
      if (!result.success) {
        response.writeHead(422).end();
        return;
      }
      parsed = result.data;
    } catch {
      response.writeHead(400).end();
      return;
    }

    try {
      const { sequence, ...input } = parsed;
      const result =
        mode === "preview"
          ? await cache.getOrRender(input, renderer.renderPreview)
          : await renderer.renderExport(input);
      response.writeHead(200, {
        "content-type": result.contentType,
        "x-overflow": String(result.overflow),
        ...(sequence !== undefined ? { "x-sequence": String(sequence) } : {}),
      });
      response.end(result.body);
    } catch (error) {
      if (error instanceof PoolFullError) {
        response.writeHead(503, { "retry-after": RETRY_AFTER_SECONDS }).end();
      } else if (error instanceof InvalidRenderInputError) {
        response.writeHead(422).end();
      } else {
        console.error("render failed", error);
        response.writeHead(500).end();
      }
    }
  });

  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  return {
    port: (server.address() as AddressInfo).port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
