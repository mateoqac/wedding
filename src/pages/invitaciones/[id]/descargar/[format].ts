import type { APIRoute } from "astro";
import { FORMATS, type Format } from "@/invitations/formats";
import { getContainer } from "@/server/container";
import { accessFor } from "@/server/http";

const page = (body: string, refresh = false) =>
  new Response(
    `<!doctype html><html lang="es-CL"><meta charset="utf-8">${refresh ? '<meta http-equiv="refresh" content="2">' : ""}<title>Descarga</title><body style="font-family:sans-serif;max-width:32rem;margin:4rem auto;text-align:center">${body}</body></html>`,
    { status: refresh ? 202 : 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

/** Zero-JS download: redirects to the signed file when ready, otherwise shows progress and refreshes. */
export const GET: APIRoute = async ({ params, cookies, locals, redirect }) => {
  const id = params.id as string;
  const format = params.format as Format;
  if (!FORMATS.includes(format)) return new Response(null, { status: 404 });
  const container = getContainer();
  const invitation = await container.invitations.load(id, accessFor(cookies, id, locals.user?.id));
  if (!invitation) return redirect("/acceso?error=no_access", 303);
  await container.bossReady;
  const result = await container.exports.requestExport({ invitationId: id, format });
  switch (result.status) {
    case "ready":
      return redirect(result.url, 303);
    case "queued":
      return page("<h1>Preparando tu archivo…</h1><p>Esto toma unos segundos. La descarga comenzará sola.</p>", true);
    case "not_paid":
      return redirect(`/invitaciones/${id}/pagar`, 303);
    case "failed":
      return page(`<h1>No pudimos generar el archivo</h1><p>Intenta de nuevo en unos segundos.</p><p><a href="">Reintentar</a></p>`);
    case "rate_limited":
      return page("<h1>Demasiadas descargas</h1><p>Intenta de nuevo en una hora.</p>");
    default:
      return new Response(null, { status: 404 });
  }
};
