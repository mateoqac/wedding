import type { APIRoute } from "astro";
import { SESSION_COOKIE } from "@/auth/tokens";
import { getContainer } from "@/server/container";

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) await getContainer().auth.signOut(token);
  cookies.delete(SESSION_COOKIE, { path: "/" });
  return redirect("/", 303);
};
