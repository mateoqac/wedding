import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import { SIGNED_URL_TTL_SECONDS, type FileStorage } from "./storage";

/** Filesystem storage for development and tests; URLs are HMAC-signed like R2's presigned URLs. */
export function createLocalStorage({
  directory,
  signingSecret,
  baseUrl,
  now = () => new Date(),
}: {
  directory: string;
  signingSecret: string;
  baseUrl: string;
  now?: () => Date;
}): FileStorage & { read(key: string, expires: string, signature: string): Promise<Buffer | null> } {
  const sign = (key: string, expires: string) =>
    createHmac("sha256", signingSecret).update(`${key}:${expires}`).digest("hex");

  const resolve = (key: string) => {
    const path = normalize(join(directory, key));
    if (!path.startsWith(normalize(directory) + sep)) throw new Error("Invalid storage key");
    return path;
  };

  return {
    async put(key, body) {
      const path = resolve(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
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
      try {
        return await readFile(resolve(key));
      } catch {
        return null;
      }
    },
  };
}
