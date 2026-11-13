import type { APIRoute } from "astro";
import { isFakeGateway } from "@/payments/fake-gateway-guard";
import { getContainer } from "@/server/container";

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Development-only stand-in for the gateway's hosted payment page (D12). */
export const GET: APIRoute = async ({ url }) => {
  const gateway = getContainer().gateway;
  const ref = url.searchParams.get("ref") ?? "";
  if (!isFakeGateway(gateway) || !(await gateway.getPayment(ref))) {
    return new Response(null, { status: 404 });
  }
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Pago de prueba</title>
<body style="font-family:sans-serif;max-width:28rem;margin:4rem auto;text-align:center">
<h1>Pasarela de prueba</h1><p>Este pago no es real.</p>
<form method="post"><input type="hidden" name="ref" value="${escape(ref)}">
<button name="result" value="approved">Aprobar pago</button>
<button name="result" value="rejected">Rechazar pago</button></form></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
};

export const POST: APIRoute = async ({ request, redirect }) => {
  const gateway = getContainer().gateway;
  if (!isFakeGateway(gateway)) return new Response(null, { status: 404 });
  const form = await request.formData();
  const ref = String(form.get("ref") ?? "");
  if (!(await gateway.getPayment(ref))) return new Response(null, { status: 404 });
  await gateway.setStatus(ref, form.get("result") === "approved" ? "approved" : "rejected");
  return redirect(`/checkout/retorno?ref=${encodeURIComponent(ref)}`, 303);
};
