import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FORMATS } from "@/invitations/formats";
import { listTemplates } from "./registry";

const QR = '<svg data-qr="1"></svg>';
const escaped = (text: string) => text.replaceAll("'", "&#x27;");

// Contract every registered template must honour (design §5): pure markup, no network,
// names always present, QR only where links cannot be clicked, crop marks only for print.
describe.each(listTemplates().map((t) => [t.meta.id, t] as const))("template %s", (_id, template) => {
  const render = (data: unknown, format: (typeof FORMATS)[number], options = template.defaultOptions) => {
    const qrCodes = Object.fromEntries(template.links(data).map((l) => [l, QR]));
    return renderToStaticMarkup(createElement(template.Component, { data, options, format, qrCodes }));
  };

  for (const [name, data] of Object.entries(template.fixtures)) {
    for (const format of FORMATS) {
      it(`renders ${name} in ${format}`, () => {
        const html = render(data, format);
        const facts = template.facts(data);
        for (const couple of facts.coupleNames) expect(html).toContain(escaped(couple.split(" ")[0]));
        expect(html).not.toMatch(/\ssrc="https?:/);
        expect(html).not.toMatch(/url\(\s*['"]?https?:/);
        if (format !== "digital-pdf") expect(html).not.toMatch(/href="https?:/);
        expect(html.includes('data-crop-marks="1"')).toBe(format === "print-pdf");
      });
    }
  }

  it("renders links as QR except in the digital PDF", () => {
    const data = template.fixtures.typical;
    expect(render(data, "png")).toContain('data-qr="1"');
    expect(render(data, "digital-pdf")).not.toContain('data-qr="1"');
  });

  it("offers only option choices its schema accepts, and defaults are valid", () => {
    expect(template.optionsSchema.safeParse(template.defaultOptions).success).toBe(true);
    for (const spec of template.optionSpecs) {
      for (const choice of Object.keys(spec.choices)) {
        const options = { ...template.defaultOptions, [spec.name]: choice };
        expect(template.optionsSchema.safeParse(options).success, `${spec.name}=${choice}`).toBe(true);
      }
    }
  });

  it("renders every option combination of each single option", () => {
    for (const spec of template.optionSpecs) {
      for (const choice of Object.keys(spec.choices)) {
        const html = render(template.fixtures.typical, "png", { ...template.defaultOptions, [spec.name]: choice });
        expect(html.length).toBeGreaterThan(500);
      }
    }
  });

  it("inlines its fonts with latin-ext and no remote URLs", () => {
    const css = template.fontFaceCss(template.defaultOptions);
    expect(css).toContain("data:font/woff2;base64,");
    expect(css).toContain("U+0100");
    expect(css).not.toMatch(/url\(\s*['"]?https?:/);
  });
});

it("registers unique template ids", () => {
  const ids = listTemplates().map((t) => t.meta.id);
  expect(new Set(ids).size).toBe(ids.length);
});
