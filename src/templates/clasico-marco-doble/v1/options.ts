import { z } from "zod";

export const FONT_OPTIONS = ["cormorant", "playfair", "great-vibes"] as const;
export const COLOR_OPTIONS = ["oro", "azul-noche", "verde-salvia"] as const;

export const optionsSchema = z.object({
  font: z.enum(FONT_OPTIONS),
  color: z.enum(COLOR_OPTIONS),
  emblem: z.enum(["anillos", "ninguno"]),
  frame: z.enum(["doble", "simple"]),
});

export type TemplateOptions = z.infer<typeof optionsSchema>;
export type FontOption = TemplateOptions["font"];

export const defaultOptions: TemplateOptions = {
  font: "cormorant",
  color: "oro",
  emblem: "anillos",
  frame: "doble",
};

export const COLORS: Record<TemplateOptions["color"], string> = {
  oro: "#9a7b3f",
  "azul-noche": "#1f2f4f",
  "verde-salvia": "#5d7360",
};

export const OPTION_LABELS = {
  font: { cormorant: "Cormorant Garamond", playfair: "Playfair Display", "great-vibes": "Great Vibes" },
  color: { oro: "Oro", "azul-noche": "Azul noche", "verde-salvia": "Verde salvia" },
  emblem: { anillos: "Anillos", ninguno: "Sin emblema" },
  frame: { doble: "Marco doble", simple: "Marco simple" },
} as const;
