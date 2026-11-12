import { describe, expect, it } from "vitest";
import {
  ACCESS_LINK_TTL_MS,
  EDIT_TOKEN_TTL_MS,
  SESSION_TTL_MS,
  authCookieOptions,
  generateToken,
  hashToken,
  normalizeEmail,
} from "./tokens";

const DAY = 24 * 60 * 60 * 1000;

describe("auth tokens", () => {
  it("generates 32 random bytes encoded as base64url", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(generateToken()).not.toBe(token);
  });

  it("hashes tokens with SHA-256 as lowercase hex", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("uses the agreed lifetimes", () => {
    expect(SESSION_TTL_MS).toBe(30 * DAY);
    expect(ACCESS_LINK_TTL_MS).toBe(15 * 60 * 1000);
    expect(EDIT_TOKEN_TTL_MS).toBe(30 * DAY);
  });

  it("builds HttpOnly, Secure, SameSite=Lax cookie options", () => {
    expect(authCookieOptions(SESSION_TTL_MS)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  });

  it("normalizes emails by trimming and lowercasing", () => {
    expect(normalizeEmail("  Ana.Perez@Example.CL ")).toBe("ana.perez@example.cl");
  });
});
