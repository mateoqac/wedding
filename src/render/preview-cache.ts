import { contentHash } from "@/invitations/content-hash";
import type { RenderInput } from "./document";
import type { RenderResult } from "./renderer";

/** In-memory LRU keyed by content hash: identical input never relaunches Chromium (D3). */
export function createPreviewCache(maxEntries = 200) {
  const entries = new Map<string, Promise<RenderResult>>();

  return {
    async getOrRender(input: RenderInput, render: (input: RenderInput) => Promise<RenderResult>) {
      const key = contentHash({
        templateId: input.templateId,
        templateVersion: input.templateVersion,
        format: input.format,
        data: input.data,
        options: input.options,
      });
      const hit = entries.get(key);
      if (hit) {
        entries.delete(key);
        entries.set(key, hit);
        return hit;
      }
      const pending = render(input);
      entries.set(key, pending);
      pending.catch(() => entries.delete(key));
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value as string);
      return pending;
    },
  };
}
