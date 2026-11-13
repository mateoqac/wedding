// @ts-check
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';

const require = createRequire(import.meta.url);

/**
 * Package root from its main entry (works for packages that do not export package.json).
 * @param {string} name
 */
function packageRoot(name) {
  let dir = dirname(require.resolve(name));
  while (!dir.endsWith(join('node_modules', ...name.split('/')))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`Cannot find package root of ${name}`);
    dir = parent;
  }
  return dir;
}

/**
 * Files read at runtime through computed paths, which the function bundler cannot trace:
 * template fonts (base64-inlined into each render) and the serverless Chromium binary.
 */
function runtimeFiles() {
  // Fonts are copied to ./fonts by scripts/copy-fonts.mjs (run in vercel-build).
  const files = existsSync('fonts') ? readdirSync('fonts').map((f) => join('fonts', f)) : [];
  const chromiumBin = join(packageRoot('@sparticuz/chromium'), 'bin');
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
