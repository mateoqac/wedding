import type { APIRoute } from "astro";
import { getContainer } from "@/server/container";
import { listTemplates } from "@/templates/registry";

/** Gallery thumbnail: the template's typical fixture rendered by the preview service (cached there). */
export const GET: APIRoute = async ({ params }) => {
  const template = listTemplates().find((t) => t.meta.id === params.id);
  if (!template) return new Response(null, { status: 404 });
  const result = await getContainer().previewClient.render({
    templateId: template.meta.id,
    templateVersion: template.meta.version,
    data: Object.values(template.fixtures)[0],
    options: template.defaultOptions,
    format: "png",
  });
  if (result.status !== "ok") return new Response(null, { status: 503, headers: { "retry-after": "5" } });
  return new Response(new Uint8Array(result.body), {
    headers: { "content-type": result.contentType, "cache-control": "public, max-age=3600" },
  });
};
