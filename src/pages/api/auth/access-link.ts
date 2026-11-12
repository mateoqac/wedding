import type { APIRoute } from "astro";
import { getContainer } from "@/server/container";
import { clientIp } from "@/server/http";

export const POST: APIRoute = async ({ request, redirect, clientAddress }) => {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  if (!email.includes("@")) return redirect("/acceso?error=invalid_email", 303);
  const result = await getContainer().auth.requestAccessLink({ email, ip: clientIp(request, clientAddress) });
  return redirect(result === "sent" ? "/acceso?enviado=1" : "/acceso?error=rate_limited", 303);
};
