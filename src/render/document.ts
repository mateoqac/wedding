import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import QRCode from "qrcode";
import type { Format } from "@/invitations/formats";
import { getTemplate } from "@/templates/registry";

export interface RenderInput {
  templateId: string;
  templateVersion: number;
  data: unknown;
  options: unknown;
  format: Format;
}

export class InvalidRenderInputError extends Error {}

const CSS_PX_PER_MM = 96 / 25.4;

export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 0 });
}

const WATERMARK_CSS = `.wm{position:fixed;inset:-50%;display:flex;flex-wrap:wrap;align-content:space-around;justify-content:space-around;transform:rotate(-30deg);pointer-events:none;z-index:9999}
.wm span{font:700 48px sans-serif;color:rgba(0,0,0,0.18);padding:40px 60px;letter-spacing:4px}`;

/**
 * Builds the self-contained HTML document for one render: template markup, inlined fonts,
 * page size, and (for previews) the burned-in watermark. Nothing references the network.
 */
export async function buildDocument(input: RenderInput, { watermark }: { watermark: boolean }) {
  const template = getTemplate(input.templateId, input.templateVersion);
  const data = template.dataSchema.safeParse(input.data);
  const options = template.optionsSchema.safeParse(input.options ?? template.defaultOptions);
  if (!data.success || !options.success) throw new InvalidRenderInputError("Invalid invitation data or options");

  const geometry = template.formats[input.format];
  const qrCodes: Record<string, string> = {};
  if (geometry.links === "qr") {
    for (const link of template.links(data.data)) qrCodes[link] = await qrSvg(link);
  }
  const markup = renderToStaticMarkup(
    createElement(template.Component, { data: data.data, options: options.data, format: input.format, qrCodes }),
  );
  const factor = geometry.unit === "mm" ? CSS_PX_PER_MM : 1;
  const size = { width: Math.round(geometry.width * factor), height: Math.round(geometry.height * factor) };
  const marks = watermark ? `<div class="wm">${"<span>VISTA PREVIA</span>".repeat(60)}</div>` : "";
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${template.fontFaceCss(options.data.font)}
@page{size:${geometry.width}${geometry.unit} ${geometry.height}${geometry.unit};margin:0}
html,body{margin:0}${watermark ? WATERMARK_CSS : ""}</style></head><body>${markup}${marks}</body></html>`;
  return { html, size, geometry };
}
