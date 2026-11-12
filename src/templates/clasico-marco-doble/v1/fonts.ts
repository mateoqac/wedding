import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { FontOption } from "./options";

const require = createRequire(import.meta.url);

const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

export const FONTS: Record<FontOption, { family: string; pkg: string; slug: string; weights: number[] }> = {
  cormorant: { family: "Cormorant Garamond", pkg: "@fontsource/cormorant-garamond", slug: "cormorant-garamond", weights: [400, 600] },
  playfair: { family: "Playfair Display", pkg: "@fontsource/playfair-display", slug: "playfair-display", weights: [400, 700] },
  "great-vibes": { family: "Great Vibes", pkg: "@fontsource/great-vibes", slug: "great-vibes", weights: [400] },
};

const cache = new Map<FontOption, string>();

/** @font-face rules with base64-inlined woff2, so Chromium never needs the network (D1). */
export function fontFaceCss(font: FontOption): string {
  const cached = cache.get(font);
  if (cached) return cached;
  const { family, pkg, slug, weights } = FONTS[font];
  const rules: string[] = [];
  for (const weight of weights) {
    for (const [subset, range] of [["latin", LATIN], ["latin-ext", LATIN_EXT]] as const) {
      const file = require.resolve(`${pkg}/files/${slug}-${subset}-${weight}-normal.woff2`);
      const data = readFileSync(file).toString("base64");
      rules.push(
        `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${data}) format('woff2');unicode-range:${range};}`,
      );
    }
  }
  const css = rules.join("\n");
  cache.set(font, css);
  return css;
}
