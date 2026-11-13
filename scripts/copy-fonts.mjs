// Copies the template fonts (latin + latin-ext woff2) from @fontsource into ./fonts so
// serverless bundles can ship them as plain files (pnpm's node_modules layout is not
// resolvable inside a Vercel function). Run before `astro build` on Vercel.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const PACKAGES = ['cormorant-garamond', 'playfair-display', 'great-vibes', 'bodoni-moda', 'inter', 'libre-baskerville', 'caveat'];

mkdirSync('fonts', { recursive: true });
let count = 0;
for (const pkg of PACKAGES) {
  const dir = join(dirname(require.resolve(`@fontsource/${pkg}/index.css`)), 'files');
  for (const file of readdirSync(dir)) {
    if (/-latin(-ext)?-\d+-(normal|italic)\.woff2$/.test(file)) {
      copyFileSync(join(dir, file), join('fonts', file));
      count++;
    }
  }
}
console.log(`copied ${count} font files to ./fonts`);
