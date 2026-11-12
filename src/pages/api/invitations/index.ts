import type { APIRoute } from "astro";
import { getContainer } from "@/server/container";
import { clientIp, setEditToken } from "@/server/http";

/** Creates an anonymous draft (form post from the gallery) and opens the editor. */
export const POST: APIRoute = async ({ request, cookies, redirect, clientAddress }) => {
  const form = await request.formData();
  const result = await getContainer().invitations.createDraft({
    templateId: String(form.get("templateId") ?? ""),
    ip: clientIp(request, clientAddress),
  });
  if (result.status === "unknown_template") return new Response("Plantilla desconocida", { status: 404 });
  if (result.status === "rate_limited") {
    return new Response("Has creado muchos borradores. Intenta de nuevo en una hora.", { status: 429 });
  }
  setEditToken(cookies, result.invitationId, result.editToken);
  return redirect(`/editor/${result.invitationId}`, 303);
};
