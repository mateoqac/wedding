import { defineConfig } from "@playwright/test";

/**
 * Visual regression (T12, D11). Snapshots are only stable inside the pinned Playwright image:
 * run `pnpm test:visual:docker` to compare, or `pnpm test:visual:update` to accept intended changes.
 */
export default defineConfig({
  testDir: "tests/visual",
  timeout: 60_000,
  workers: 2,
  expect: { toMatchSnapshot: { maxDiffPixelRatio: 0.001 } },
  snapshotPathTemplate: "{testDir}/__snapshots__/{arg}{ext}",
});
