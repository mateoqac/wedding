import type { ComponentType } from "react";
import type { z } from "zod";
import { extractFacts } from "@/templates/clasico-marco-doble/v1/facts";
import { fixtures } from "@/templates/clasico-marco-doble/v1/fixtures";
import { formats } from "@/templates/clasico-marco-doble/v1/formats";
import { invitationDataSchema } from "@/templates/clasico-marco-doble/v1/schema";
import type { TemplateModule } from "@/templates/registry";
import { fontFaceCss, type FontKey } from "./fonts";

export interface OptionSpec {
  name: string;
  label: string;
  choices: Record<string, string>;
}

/**
 * Builds a template that shares the reference data fields (same editor form, fixtures,
 * page geometry and facts) and only brings its own look: component, options and fonts.
 */
export function defineSharedDataTemplate<O extends Record<string, string>>({
  meta,
  optionsSchema,
  defaultOptions,
  optionSpecs,
  Component,
  fonts,
}: {
  meta: TemplateModule["meta"];
  optionsSchema: z.ZodType<O>;
  defaultOptions: O;
  optionSpecs: OptionSpec[];
  // biome-ignore lint: props validated by the template schemas
  Component: ComponentType<any>;
  fonts: (options: O) => FontKey[];
}): TemplateModule {
  return {
    meta,
    dataSchema: invitationDataSchema,
    optionsSchema,
    defaultOptions,
    optionSpecs,
    formats,
    Component,
    fontFaceCss: (options) => fontFaceCss(fonts({ ...defaultOptions, ...(options as O) })),
    fixtures,
    facts: extractFacts,
    links: (data) => {
      const d = invitationDataSchema.parse(data);
      return [d.venueMapUrl, d.giftRegistry?.url].filter((l): l is string => !!l);
    },
  };
}
