import { expect, test } from "@playwright/test";
import { chromium } from "playwright";
import { buildDocument } from "../../src/render/document";
import { FORMATS } from "../../src/invitations/formats";
import { listTemplates } from "../../src/templates/registry";
import { FONT_OPTIONS, defaultOptions } from "../../src/templates/clasico-marco-doble/v1/options";

/**
 * Visual regression (design §9, D11). Snapshots are generated inside the pinned Playwright image:
 * `pnpm test:visual:docker` (add `-- --update-snapshots` to accept intended changes).
 * Published template versions must keep their snapshots unchanged.
 */
async function snapshot(html: string, size: { width: number; height: number }) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: size });
  await page.route("**/*", (route) =>
    route.request().url().startsWith("data:") ? route.continue() : route.abort("blockedbyclient"),
  );
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const image = await page.screenshot({ clip: { x: 0, y: 0, ...size } });
  await browser.close();
  return image;
}

for (const template of listTemplates()) {
  const { id, version } = template.meta;

  test.describe(`${id} v${version} layout matrix`, () => {
    for (const format of FORMATS) {
      for (const [fixture, data] of Object.entries(template.fixtures)) {
        test(`${format} / ${fixture}`, async () => {
          const { html, size } = await buildDocument(
            { templateId: id, templateVersion: version, data, options: template.defaultOptions, format },
            { watermark: false },
          );
          expect(await snapshot(html, size)).toMatchSnapshot(`${id}-v${version}-${format}-${fixture}.png`);
        });
      }
    }
  });
}

test.describe("font specimens (print format, long-names fixture)", () => {
  const template = listTemplates().find((t) => t.meta.id === "clasico-marco-doble");
  for (const font of FONT_OPTIONS) {
    test(font, async () => {
      if (!template) throw new Error("reference template missing");
      const { html, size } = await buildDocument(
        {
          templateId: "clasico-marco-doble",
          templateVersion: 1,
          data: template.fixtures.extreme,
          options: { ...defaultOptions, font },
          format: "print-pdf",
        },
        { watermark: false },
      );
      expect(await snapshot(html, size)).toMatchSnapshot(`font-specimen-${font}.png`);
    });
  }
});

test("a template that references an external URL renders with the request blocked", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const blocked: string[] = [];
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith("data:") || url.startsWith("about:")) return route.continue();
    blocked.push(url);
    return route.abort("blockedbyclient");
  });
  await page.setContent('<p>parte</p><img src="https://tracker.example/pixel.gif">', { waitUntil: "load" });
  expect(blocked).toEqual(["https://tracker.example/pixel.gif"]);
  await expect(page.getByText("parte")).toBeVisible();
  await browser.close();
});
