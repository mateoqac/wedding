import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

interface FontFamily {
  family: string;
  slug: string;
  weights: number[];
  italic?: boolean;
}

/** Every OFL font bundled for templates (decision D1: inlined, never fetched). */
export const FONT_FAMILIES = {
  "cormorant-garamond": { family: "Cormorant Garamond", slug: "cormorant-garamond", weights: [400, 600] },
  "playfair-display": { family: "Playfair Display", slug: "playfair-display", weights: [400, 700] },
  "great-vibes": { family: "Great Vibes", slug: "great-vibes", weights: [400] },
  "bodoni-moda": { family: "Bodoni Moda", slug: "bodoni-moda", weights: [400, 600], italic: true },
  inter: { family: "Inter", slug: "inter", weights: [300, 500] },
  "libre-baskerville": { family: "Libre Baskerville", slug: "libre-baskerville", weights: [400], italic: true },
  caveat: { family: "Caveat", slug: "caveat", weights: [500] },
} satisfies Record<string, FontFamily>;

export type FontKey = keyof typeof FONT_FAMILIES;

const cache = new Map<FontKey, string>();

/**
 * Prefers the copy in ./fonts (made by scripts/copy-fonts.mjs for serverless bundles, where
 * pnpm's node_modules cannot be resolved), else the @fontsource package.
 */
function fontFile(fileName: string, slug: string): string {
  const bundled = join(process.cwd(), "fonts", fileName);
  if (existsSync(bundled)) return bundled;
  return require.resolve(`@fontsource/${slug}/files/${fileName}`);
}

function familyCss(key: FontKey): string {
  const cached = cache.get(key);
  if (cached) return cached;
  const font: FontFamily = FONT_FAMILIES[key];
  const rules: string[] = [];
  const styles = font.italic ? ["normal", "italic"] : ["normal"];
  for (const weight of font.weights) {
    for (const style of styles) {
      for (const [subset, range] of [["latin", LATIN], ["latin-ext", LATIN_EXT]] as const) {
        const data = readFileSync(fontFile(`${font.slug}-${subset}-${weight}-${style}.woff2`, font.slug)).toString("base64");
        rules.push(
          `@font-face{font-family:'${font.family}';font-style:${style};font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${data}) format('woff2');unicode-range:${range};}`,
        );
      }
    }
  }
  const css = rules.join("\n");
  cache.set(key, css);
  return css;
}

/** @font-face rules with base64-inlined woff2 for the given families (deduplicated). */
export function fontFaceCss(keys: FontKey[]): string {
  return [...new Set(keys)].map(familyCss).join("\n");
}

export const fontFamily = (key: FontKey) => FONT_FAMILIES[key].family;
