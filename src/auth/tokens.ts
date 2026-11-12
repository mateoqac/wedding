import { createHash, randomBytes } from "node:crypto";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const SESSION_TTL_MS = 30 * DAY_MS;
export const ACCESS_LINK_TTL_MS = 15 * MINUTE_MS;
export const EDIT_TOKEN_TTL_MS = 30 * DAY_MS;

export const SESSION_COOKIE = "session";
export const EDIT_TOKEN_COOKIE = "edit_token";

/** 32 random bytes, base64url. Only the hash is ever stored. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Lax so the first click from the email carries the cookie on later navigations. */
export function authCookieOptions(ttlMs: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(ttlMs / 1000),
  };
}
