import { createHmac, timingSafeEqual } from "node:crypto";
import { get, put } from "@vercel/blob";
import type { LocalStorage } from "./local-storage";
import { SIGNED_URL_TTL_SECONDS } from "./storage";

/**
 * Vercel Blob (private store) for serverless deployments. Files are never exposed by a
 * Blob URL: the app serves them at /files/... behind the same HMAC-signed, 5-minute links
 * as local storage, so ownership checks stay in the app.
 */
export function createBlobStorage({
  signingSecret,
  baseUrl,
  token,
  now = () => new Date(),
}: {
  signingSecret: string;
  baseUrl: string;
  token?: string;
  now?: () => Date;
}): LocalStorage {
  const sign = (key: string, expires: string) =>
    createHmac("sha256", signingSecret).update(`${key}:${expires}`).digest("hex");

  return {
    async put(key, body, contentType) {
      await put(key, body, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true, token });
    },

    async signedUrl(key) {
      const expires = String(Math.floor(now().getTime() / 1000) + SIGNED_URL_TTL_SECONDS);
      const url = new URL(`/files/${key}`, baseUrl);
      url.searchParams.set("expires", expires);
      url.searchParams.set("signature", sign(key, expires));
      return url.toString();
    },

    async read(key, expires, signature) {
      if (Number(expires) * 1000 < now().getTime()) return null;
      const expected = Buffer.from(sign(key, expires));
      const given = Buffer.from(signature);
      if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
      const result = await get(key, { access: "private", token });
      if (!result?.stream) return null;
      return Buffer.from(await new Response(result.stream).arrayBuffer());
    },
  };
}
