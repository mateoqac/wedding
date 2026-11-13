/**
 * Renders every template × fixture × format with the real renderer, reports overflow
 * (text that does not fit the design) and writes PNG previews to .data/previews.
 * Usage: pnpm templates:check [templateId]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { FORMATS } from "../src/invitations/formats";
import { createRenderer } from "../src/render/renderer";
import { listTemplates } from "../src/templates/registry";

const only = process.argv[2];
const browser = await chromium.launch();
const renderer = createRenderer({ browser });
await mkdir(".data/previews", { recursive: true });
let failures = 0;

for (const template of listTemplates().filter((t) => !only || t.meta.id === only)) {
  for (const [fixture, data] of Object.entries(template.fixtures)) {
    for (const format of FORMATS) {
      const input = { templateId: template.meta.id, templateVersion: template.meta.version, data, options: template.defaultOptions, format };
      const { overflow } = await renderer.renderExport(input);
      if (overflow) failures++;
      if (format === "png" || format === "story") {
        const preview = await renderer.renderPreview(input);
        await writeFile(`.data/previews/${template.meta.id}-${fixture}-${format}.jpg`, preview.body);
      }
      console.log(`${overflow ? "OVERFLOW" : "ok      "} ${template.meta.id} ${fixture} ${format}`);
    }
  }
}
await browser.close();
process.exit(failures ? 1 : 0);
