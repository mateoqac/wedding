import type { APIRoute } from "astro";
import { getContainer } from "@/server/container";
import { setSession } from "@/server/http";

/** Access link target: consumes the single-use token and opens a session. */
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const token = url.searchParams.get("token") ?? "";
  const result = await getContainer().auth.consumeAccessLink(token);
  if (result.status !== "ok") return redirect(`/acceso?error=${result.status}`, 303);
  setSession(cookies, result.sessionToken);
  return redirect("/mis-invitaciones", 303);
};
