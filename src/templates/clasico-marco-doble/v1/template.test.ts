import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FORMATS, type Format } from "@/invitations/formats";
import { getTemplate } from "@/templates/registry";
import { fixtures } from "./fixtures";
import { formatSpanishDate } from "./Template";
import { defaultOptions, optionsSchema } from "./options";

const template = getTemplate("clasico-marco-doble", 1);
const QR = '<svg data-qr="1"></svg>';
const escaped = (text: string) => text.replaceAll("'", "&#x27;");

function render(name: keyof typeof fixtures, format: Format) {
  const data = fixtures[name];
  const links = [data.venueMapUrl, data.giftRegistry?.url].filter((l): l is string => !!l);
  const qrCodes = Object.fromEntries(links.map((l) => [l, QR]));
  return renderToStaticMarkup(
    createElement(template.Component, { data, options: defaultOptions, format, qrCodes }),
  );
}

describe("clasico-marco-doble v1 template", () => {
  for (const name of Object.keys(fixtures) as (keyof typeof fixtures)[]) {
    for (const format of FORMATS) {
      it(`renders ${name} in ${format} with names and no external resources`, () => {
        const html = render(name, format);
        expect(html).toContain(escaped(fixtures[name].couple.partnerOne));
        expect(html).toContain(escaped(fixtures[name].couple.partnerTwo));
        expect(html).not.toMatch(/\ssrc="https?:/);
        expect(html).not.toMatch(/url\(\s*['"]?https?:/);
        if (format !== "digital-pdf") expect(html).not.toMatch(/href="https?:/);
      });
    }
  }

  it("removes empty optional blocks in the minimal fixture", () => {
    const html = render("minimal", "digital-pdf");
    expect(html).not.toContain('data-block="party"');
    expect(html).not.toContain('data-block="gift"');
    expect(html).not.toContain('data-block="map"');
    expect(render("typical", "digital-pdf")).toContain('data-block="party"');
  });

  it("renders links as QR in raster and print formats, clickable in digital PDF", () => {
    for (const format of ["print-pdf", "png", "jpg", "story"] as const) {
      expect(render("typical", format)).toContain('data-qr="1"');
    }
    const digital = render("typical", "digital-pdf");
    expect(digital).not.toContain('data-qr="1"');
    expect(digital).toContain(`href="${fixtures.typical.venueMapUrl}"`);
  });

  it("draws crop marks only on the print PDF", () => {
    expect(render("typical", "print-pdf")).toContain('data-crop-marks="1"');
    expect(render("typical", "png")).not.toContain('data-crop-marks="1"');
  });

  it("declares the agreed page geometry", () => {
    expect(template.formats["print-pdf"]).toMatchObject({ width: 216, height: 156, unit: "mm", bleed: 3 });
    expect(template.formats["digital-pdf"]).toMatchObject({ width: 210, height: 150, unit: "mm" });
    expect(template.formats.png).toMatchObject({ width: 2480, height: 1772, unit: "px" });
    expect(template.formats.story).toMatchObject({ width: 1080, height: 1920, unit: "px" });
  });

  it("formats dates in Chilean Spanish", () => {
    expect(formatSpanishDate("2027-03-13")).toBe("sábado 13 de marzo de 2027");
  });

  it("rejects unknown option values and accepts defaults", () => {
    expect(optionsSchema.safeParse(defaultOptions).success).toBe(true);
    expect(optionsSchema.safeParse({ ...defaultOptions, color: "rojo" }).success).toBe(false);
  });

  it("validates every fixture against the data schema", () => {
    for (const data of Object.values(fixtures)) {
      expect(template.dataSchema.safeParse(data).success).toBe(true);
    }
  });

  it("inlines fonts as data URLs including latin-ext", () => {
    const css = template.fontFaceCss("cormorant");
    expect(css).toContain("@font-face");
    expect(css).toContain("data:font/woff2;base64,");
    expect(css).not.toMatch(/url\(\s*['"]?https?:/);
    expect(css).toContain("U+0100");
  });
});
