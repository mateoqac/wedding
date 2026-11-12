import type { APIRoute } from "astro";
import { getContainer } from "@/server/container";

/** Gateway return URL: reconciles directly with the gateway, never trusting the query string. */
export const GET: APIRoute = async ({ url, redirect }) => {
  const ref = url.searchParams.get("ref");
  if (!ref) return redirect("/", 303);
  const result = await getContainer().invitations.completeCheckout(ref);
  if (result.status === "unknown") return redirect("/", 303);
  if (result.status === "paid") return redirect(`/invitaciones/${result.invitationId}/descargas?pagado=1`, 303);
  return redirect(`/invitaciones/${result.invitationId}/pagar?error=payment_${result.status}`, 303);
};
