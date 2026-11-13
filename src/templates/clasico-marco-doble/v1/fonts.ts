import { fontFaceCss as sharedFontFaceCss, type FontKey } from "@/templates/shared/fonts";
import type { FontOption } from "./options";

const FONT_KEYS: Record<FontOption, FontKey> = {
  cormorant: "cormorant-garamond",
  playfair: "playfair-display",
  "great-vibes": "great-vibes",
};

export const FONTS: Record<FontOption, { family: string }> = {
  cormorant: { family: "Cormorant Garamond" },
  playfair: { family: "Playfair Display" },
  "great-vibes": { family: "Great Vibes" },
};

/** @font-face rules with base64-inlined woff2, so Chromium never needs the network (D1). */
export function fontFaceCss(font: FontOption): string {
  return sharedFontFaceCss([FONT_KEYS[font]]);
}
