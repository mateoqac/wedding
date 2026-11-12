import { defineMiddleware } from "astro:middleware";
import { SESSION_COOKIE } from "@/auth/tokens";
import { getContainer } from "@/server/container";

/** Resolves the session cookie into `locals.user` for every request. */
export const onRequest = defineMiddleware(async (context, next) => {
  const token = context.cookies.get(SESSION_COOKIE)?.value;
  context.locals.user = token ? await getContainer().auth.getSessionUser(token) : null;
  return next();
});
