import type { ComponentType } from "react";
import type { z } from "zod";
import type { Format } from "@/invitations/formats";
import { extractFacts as clasicoMarcoDobleV1Facts } from "./clasico-marco-doble/v1/facts";
import { fixtures as clasicoFixtures } from "./clasico-marco-doble/v1/fixtures";
import { fontFaceCss as clasicoFontFaceCss } from "./clasico-marco-doble/v1/fonts";
import { formats as clasicoFormats, type FormatGeometry } from "./clasico-marco-doble/v1/formats";
import { meta as clasicoMeta } from "./clasico-marco-doble/v1/meta";
import {
  OPTION_LABELS as clasicoLabels,
  defaultOptions as clasicoDefaults,
  optionsSchema as clasicoOptions,
} from "./clasico-marco-doble/v1/options";
import { invitationDataSchema as clasicoData } from "./clasico-marco-doble/v1/schema";
import { Template as ClasicoTemplate } from "./clasico-marco-doble/v1/Template";
import { editorialV1 } from "./editorial/v1";
import { monogramaV1 } from "./monograma/v1";
import { botanicaNeutraV1 } from "./botanica-neutra/v1";
import { neutroCalidoV1 } from "./neutro-calido/v1";

/** Template-independent facts the domain needs from an invitation's data. */
export interface InvitationFacts {
  coupleNames: string[];
  /** Wedding date as `YYYY-MM-DD`. */
  weddingDate: string;
}

export interface TemplateModule {
  meta: { id: string; version: number; name: string; description: string };
  // biome-ignore lint: template-specific data shape
  dataSchema: z.ZodType<any>;
  // biome-ignore lint: template-specific options shape
  optionsSchema: z.ZodType<any>;
  defaultOptions: Record<string, string>;
  /** Choices shown in the editor's "Estilo" section, in order. */
  optionSpecs: { name: string; label: string; choices: Record<string, string> }[];
  formats: Record<Format, FormatGeometry>;
  // biome-ignore lint: props validated by the template schemas
  Component: ComponentType<any>;
  /** @font-face rules for the fonts these options use. */
  fontFaceCss(options: unknown): string;
  fixtures: Record<string, unknown>;
  facts(data: unknown): InvitationFacts;
  /** Link URLs that need QR codes in raster/print formats. */
  links(data: unknown): string[];
}

const TEMPLATES: Record<string, Record<number, TemplateModule>> = {
  "clasico-marco-doble": {
    1: {
      meta: clasicoMeta,
      dataSchema: clasicoData,
      optionsSchema: clasicoOptions,
      defaultOptions: clasicoDefaults,
      formats: clasicoFormats,
      Component: ClasicoTemplate,
      optionSpecs: [
        { name: "font", label: "Tipografía", choices: clasicoLabels.font },
        { name: "color", label: "Color", choices: clasicoLabels.color },
        { name: "emblem", label: "Emblema", choices: clasicoLabels.emblem },
        { name: "frame", label: "Marco", choices: clasicoLabels.frame },
      ],
      fontFaceCss: (options) =>
        clasicoFontFaceCss(((options as { font?: string })?.font ?? clasicoDefaults.font) as never),
      fixtures: clasicoFixtures,
      facts: clasicoMarcoDobleV1Facts,
      links: (data) => {
        const d = clasicoData.parse(data);
        return [d.venueMapUrl, d.giftRegistry?.url].filter((l): l is string => !!l);
      },
    },
  },
  editorial: { 1: editorialV1 },
  monograma: { 1: monogramaV1 },
  "botanica-neutra": { 1: botanicaNeutraV1 },
  "neutro-calido": { 1: neutroCalidoV1 },
};

export function getTemplate(templateId: string, templateVersion: number): TemplateModule {
  const template = TEMPLATES[templateId]?.[templateVersion];
  if (!template) throw new Error(`Unknown template ${templateId} v${templateVersion}`);
  return template;
}

/** Latest version of every template, for the gallery. */
export function listTemplates(): TemplateModule[] {
  return Object.values(TEMPLATES).map((versions) => {
    const latest = Math.max(...Object.keys(versions).map(Number));
    return versions[latest];
  });
}

export function getInvitationFacts(
  templateId: string,
  templateVersion: number,
  data: unknown,
): InvitationFacts {
  return getTemplate(templateId, templateVersion).facts(data);
}
