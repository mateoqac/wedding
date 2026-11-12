import { describe, expect, it } from "vitest";
import { contentHash, type ContentHashInput } from "./content-hash";

const data = { couple: { partnerOne: "Álvaro", partnerTwo: "Francisca" }, city: "Santiago" };
const options = { font: "cormorant", color: "slate" };

const base: ContentHashInput = {
  templateId: "clasico-marco-doble",
  templateVersion: 1,
  format: "print-pdf",
  data,
  options,
};

describe("contentHash", () => {
  it("is a stable sha256 hex string", () => {
    expect(contentHash(base)).toMatch(/^[0-9a-f]{64}$/);
    expect(contentHash(base)).toBe(contentHash(structuredClone(base)));
  });

  it("does not depend on object key order", () => {
    const reordered: ContentHashInput = {
      options: { color: "slate", font: "cormorant" },
      data: { city: "Santiago", couple: { partnerTwo: "Francisca", partnerOne: "Álvaro" } },
      format: "print-pdf",
      templateVersion: 1,
      templateId: "clasico-marco-doble",
    };
    expect(contentHash(reordered)).toBe(contentHash(base));
  });

  it.each([
    ["templateId", { ...base, templateId: "otra" }],
    ["templateVersion", { ...base, templateVersion: 2 }],
    ["format", { ...base, format: "story" as const }],
    ["data", { ...base, data: { ...data, city: "Valparaíso" } }],
    ["options", { ...base, options: { ...options, color: "gold" } }],
  ])("changes when %s changes", (_field, changed) => {
    expect(contentHash(changed)).not.toBe(contentHash(base));
  });
});
