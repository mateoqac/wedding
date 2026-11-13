import type { APIRoute } from "astro";
import { getContainer } from "@/server/container";
import { accessFor, json } from "@/server/http";

const MESSAGES = {
  not_found: "No encontramos esta invitación.",
  names_locked:
    "Los nombres de los novios quedaron fijados al pagar. Puedes corregir errores menores; para cambios mayores escríbenos a soporte.",
  edit_window_closed: "El plazo para editar esta invitación terminó.",
} as const;

/** Autosave from the editor. */
export const PUT: APIRoute = async ({ params, request, cookies, locals }) => {
  const id = params.id as string;
  let body: { data?: unknown; options?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const result = await getContainer().invitations.saveDraft(id, accessFor(cookies, id, locals.user?.id), {
    data: body.data,
    options: body.options,
  });
  switch (result.status) {
    case "saved":
      return json({ status: "saved" });
    case "saved_incomplete":
      // Saved; the issues tell the editor which fields are still missing.
      return json({ status: "incomplete", issues: result.issues });
    case "invalid":
      return json({ status: "invalid", issues: result.issues }, 422);
    case "not_found":
      return json({ status: result.status, message: MESSAGES.not_found }, 404);
    default:
      return json({ status: result.status, message: MESSAGES[result.status] }, 409);
  }
};
