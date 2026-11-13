import { expect, it } from "vitest";
import { formatDay, formatIsoDate } from "./dates";

it("formats ISO wedding dates in long Spanish form", () => {
  expect(formatIsoDate("2026-10-17")).toBe("17 de octubre de 2026");
  expect(formatIsoDate("2027-01-01")).toBe("1 de enero de 2027");
});

it("returns invalid dates untouched", () => {
  expect(formatIsoDate("2026-02-30")).toBe("2026-02-30");
  expect(formatIsoDate("")).toBe("");
});

it("formats an instant by its UTC calendar day", () => {
  expect(formatDay(new Date("2026-11-16T23:59:00Z"))).toBe("16 de noviembre de 2026");
});
