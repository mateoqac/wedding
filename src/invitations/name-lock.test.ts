import { describe, expect, it } from "vitest";
import { canChangeLockedName } from "./name-lock";

describe("canChangeLockedName", () => {
  const allowed = (paid: string, next: string) =>
    canChangeLockedName({ paid, next, unlocked: false });

  it("allows an unchanged name", () => {
    expect(allowed("Francisca Carmona", "Francisca Carmona")).toBe(true);
  });

  it("allows a typo fix within floor(length / 4) per word", () => {
    // "Francsica" -> "Francisca": distance 2, floor(9 / 4) = 2
    expect(allowed("Francsica Carmona", "Francisca Carmona")).toBe(true);
  });

  it("allows adding an accent", () => {
    expect(allowed("Maria Redard", "María Redard")).toBe(true);
  });

  it("rejects a different short name (3 letters must match exactly)", () => {
    expect(allowed("Ana", "Eva")).toBe(false);
  });

  it("rejects a typo beyond the per-word tolerance", () => {
    // "Carmona" -> "Carrasco": distance > floor(7 / 4) = 1
    expect(allowed("Francisca Carmona", "Francisca Carrasco")).toBe(false);
  });

  it("allows adding one word", () => {
    expect(allowed("María", "María José")).toBe(true);
  });

  it("allows removing one word", () => {
    expect(allowed("María José Redard", "María Redard")).toBe(true);
  });

  it("rejects adding two words", () => {
    expect(allowed("María", "María José Ignacia")).toBe(false);
  });

  it("rejects replacing a word (one removed + one added)", () => {
    expect(allowed("Álvaro Galán", "Álvaro Pérez")).toBe(false);
  });

  it("rejects replacing the whole name with another person", () => {
    expect(allowed("Álvaro Galán Piazzano", "Juan Soto")).toBe(false);
  });

  it("ignores case and extra whitespace", () => {
    expect(allowed("Álvaro Galán", "  álvaro   GALÁN ")).toBe(true);
  });

  it("allows any change when support unlocked the names", () => {
    expect(canChangeLockedName({ paid: "Ana", next: "Eva", unlocked: true })).toBe(true);
  });
});
