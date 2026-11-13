import type { APIRoute } from "astro";
import { getContainer } from "@/server/container";
import { accessFor } from "@/server/http";

/** Gallery form post in "change template" mode: switches the draft, keeping its data. */
export const POST: APIRoute = async ({ params, request, cookies, locals, redirect }) => {
  const id = params.id as string;
  const form = await request.formData();
  const result = await getContainer().invitations.changeTemplate(
    id,
    accessFor(cookies, id, locals.user?.id),
    String(form.get("templateId") ?? ""),
  );
  switch (result.status) {
    case "changed":
    case "already_paid":
      return redirect(`/editor/${id}`, 303);
    case "unknown_template":
      return redirect(`/plantillas?desde=${encodeURIComponent(id)}`, 303);
    default:
      return redirect("/acceso?error=no_access", 303);
  }
};
