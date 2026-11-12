import type { APIRoute } from "astro";
import { z } from "zod";
import { FORMATS } from "@/invitations/formats";
import { getContainer } from "@/server/container";
import { accessFor, json } from "@/server/http";

const bodySchema = z.object({
  data: z.unknown(),
  options: z.unknown(),
  format: z.enum(FORMATS),
  sequence: z.number().int().nonnegative(),
});

/** Server-rendered, watermarked preview (design §5). The browser never gets a clean DOM. */
export const POST: APIRoute = async ({ params, request, cookies, locals }) => {
  const id = params.id as string;
  const container = getContainer();
  const invitation = await container.invitations.load(id, accessFor(cookies, id, locals.user?.id));
  if (!invitation) return json({ error: "not_found" }, 404);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_request" }, 400);
  if (!(await container.rateLimiter.allowPreview(id))) return json({ error: "rate_limited" }, 429, { "retry-after": "60" });

  const result = await container.previewClient.render(
    {
      templateId: invitation.templateId,
      templateVersion: invitation.templateVersion,
      data: parsed.data.data,
      options: parsed.data.options,
      format: parsed.data.format,
      sequence: parsed.data.sequence,
    },
    request.signal,
  );
  const sequence = String(parsed.data.sequence);
  switch (result.status) {
    case "ok":
      return new Response(new Uint8Array(result.body), {
        headers: {
          "content-type": result.contentType,
          "cache-control": "no-store",
          "x-sequence": sequence,
          "x-overflow": String(result.overflow),
        },
      });
    case "busy":
      return json({ error: "busy" }, 503, { "retry-after": String(result.retryAfterSeconds), "x-sequence": sequence });
    case "invalid":
      return json({ error: "invalid_data" }, 422, { "x-sequence": sequence });
    default:
      return json({ error: "render_failed" }, 502, { "x-sequence": sequence });
  }
};
