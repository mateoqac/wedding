import type { AstroCookies } from "astro";
import { EDIT_TOKEN_TTL_MS, SESSION_COOKIE, SESSION_TTL_MS, authCookieOptions } from "@/auth/tokens";
import type { Access } from "@/invitations/invitation-service";

/** One edit-token cookie per draft, so a device can hold several drafts. */
export const editCookieName = (invitationId: string) => `edit_${invitationId.replaceAll("-", "")}`;

export function setEditToken(cookies: AstroCookies, invitationId: string, token: string) {
  cookies.set(editCookieName(invitationId), token, authCookieOptions(EDIT_TOKEN_TTL_MS));
}

export function setSession(cookies: AstroCookies, token: string) {
  cookies.set(SESSION_COOKIE, token, authCookieOptions(SESSION_TTL_MS));
}

export function accessFor(cookies: AstroCookies, invitationId: string, userId?: string): Access {
  return { editToken: cookies.get(editCookieName(invitationId))?.value, userId };
}

export function clientIp(request: Request, fallback?: string) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || fallback || "unknown";
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
