import type { APIRoute } from "astro";
import { isFakeGateway } from "@/payments/fake-gateway-guard";
import { getContainer } from "@/server/container";
import { accessFor } from "@/server/http";

/** Checkout form post (zero-JS page): email + invitation id, then redirect to the gateway. */
export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
  const form = await request.formData();
  const id = String(form.get("invitationId") ?? "");
  const container = getContainer();
  const result = await container.invitations.startCheckout(
    id,
    accessFor(cookies, id, locals.user?.id),
    String(form.get("email") ?? ""),
  );
  if (result.status === "redirect") {
    // The fake gateway has no hosted page; send the user to the dev stand-in (D12).
    if (isFakeGateway(container.gateway)) {
      const ref = new URL(result.url).searchParams.get("ref") ?? "";
      return redirect(`/checkout/fake?ref=${encodeURIComponent(ref)}`, 303);
    }
    return redirect(result.url, 303);
  }
  if (result.status === "already_paid") return redirect(`/invitaciones/${id}/descargas`, 303);
  if (result.status === "not_found") return new Response("No encontramos esta invitación.", { status: 404 });
  return redirect(`/invitaciones/${id}/pagar?error=${result.status}`, 303);
};
