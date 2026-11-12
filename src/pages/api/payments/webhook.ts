import type { APIRoute } from "astro";
import { getContainer } from "@/server/container";

/** Gateway webhook: verified by the adapter, then the payment is read from the gateway. */
export const POST: APIRoute = async ({ request }) => {
  const container = getContainer();
  const body = await request.text();
  const headers = Object.fromEntries(request.headers.entries());
  const providerRef = await container.gateway.verifyWebhook({ headers, body });
  if (!providerRef) return new Response(null, { status: 401 });
  await container.invitations.completeCheckout(providerRef);
  return new Response(null, { status: 204 });
};
