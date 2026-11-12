import type { Format } from "@/invitations/formats";

export interface FormatGeometry {
  width: number;
  height: number;
  unit: "mm" | "px";
  /** Bleed per side, in `unit`. */
  bleed: number;
  layout: "landscape" | "story";
  links: "qr" | "clickable";
}

/** Page geometry per format (decision D4). Print values are fixed by the print shop. */
export const formats: Record<Format, FormatGeometry> = {
  "print-pdf": { width: 216, height: 156, unit: "mm", bleed: 3, layout: "landscape", links: "qr" },
  "digital-pdf": { width: 210, height: 150, unit: "mm", bleed: 0, layout: "landscape", links: "clickable" },
  png: { width: 2480, height: 1772, unit: "px", bleed: 0, layout: "landscape", links: "qr" },
  jpg: { width: 2480, height: 1772, unit: "px", bleed: 0, layout: "landscape", links: "qr" },
  story: { width: 1080, height: 1920, unit: "px", bleed: 0, layout: "story", links: "qr" },
};
