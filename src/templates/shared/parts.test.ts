import { expect, it } from "vitest";
import { dottedDate, firstName, initialOf } from "./parts";

it("takes the first given name", () => {
  expect(firstName("  María José Ñúñez ")).toBe("María");
  expect(firstName("Ana")).toBe("Ana");
});

it("keeps accents and ñ in initials", () => {
  expect(initialOf("álvaro Galán")).toBe("Á");
  expect(initialOf("ñuñoa")).toBe("Ñ");
  expect(initialOf("   ")).toBe("?");
});

it("formats dotted dates", () => {
  expect(dottedDate("2027-03-13")).toBe("13 · 03 · 2027");
});
