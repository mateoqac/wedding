// @ts-check
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';

const require = createRequire(import.meta.url);

/**
 * Files read at runtime through computed paths, which the function bundler cannot trace:
 * template fonts (base64-inlined into each render) and the serverless Chromium binary.
 */
function runtimeFiles() {
  const files = [];
  for (const pkg of ['cormorant-garamond', 'playfair-display', 'great-vibes', 'bodoni-moda', 'inter', 'libre-baskerville', 'caveat']) {
    const dir = join(dirname(require.resolve(`@fontsource/${pkg}/package.json`)), 'files');
    for (const file of readdirSync(dir)) {
      if (/-latin(-ext)?-\d+-(normal|italic)\.woff2$/.test(file)) files.push(relative(process.cwd(), join(dir, file)));
    }
  }
  const chromiumBin = join(dirname(require.resolve('@sparticuz/chromium/package.json')), 'bin');
  for (const file of readdirSync(chromiumBin)) files.push(relative(process.cwd(), join(chromiumBin, file)));
  return files;
}

// Vercel builds set VERCEL=1; everything else (local, Docker) keeps the Node server.
const onVercel = !!process.env.VERCEL;

// https://astro.build/config
export default defineConfig({
  // Every page reads cookies or query params (sessions, edit tokens), so render on demand.
  output: 'server',
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    ssr: { external: ['@sparticuz/chromium', 'playwright-core', 'playwright'] },
  },

  adapter: onVercel
    ? vercel({ maxDuration: 60, includeFiles: runtimeFiles() })
    : node({ mode: 'standalone' }),
});
