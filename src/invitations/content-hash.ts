import { createHash } from "node:crypto";
import type { Format } from "./formats";

export interface ContentHashInput {
  templateId: string;
  templateVersion: number;
  format: Format;
  data: unknown;
  options: unknown;
}

/**
 * Cache key for generated exports (design §4): any change to the template, its version,
 * the format, the data, or the options produces a different hash.
 */
export function contentHash(input: ContentHashInput): string {
  return createHash("sha256").update(canonicalJson(input)).digest("hex");
}

/** JSON with object keys sorted recursively, so key order never changes the hash. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, current: unknown) => {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      return current;
    }
    return Object.fromEntries(
      Object.entries(current as Record<string, unknown>).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      ),
    );
  });
}
