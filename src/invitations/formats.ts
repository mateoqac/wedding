export const FORMATS = ["print-pdf", "digital-pdf", "png", "jpg", "story"] as const;

export type Format = (typeof FORMATS)[number];
