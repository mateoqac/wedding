import { describe, expect, it } from "vitest";
import { computeEditWindowEnd, isWithinEditWindow } from "./edit-window";

describe("computeEditWindowEnd", () => {
  it("ends 30 days after the wedding date (end of that day, UTC)", () => {
    const paidAt = new Date("2026-10-01T12:00:00Z");
    const end = computeEditWindowEnd({ paidAt, weddingDate: "2026-11-14" });
    expect(end.toISOString()).toBe("2026-12-15T00:00:00.000Z");
  });

  it("is capped at 18 months after payment", () => {
    const paidAt = new Date("2026-01-10T12:00:00Z");
    const end = computeEditWindowEnd({ paidAt, weddingDate: "2029-06-01" });
    expect(end.toISOString()).toBe("2027-07-10T12:00:00.000Z");
  });

  it("clamps the 18-month cap to the last day of a shorter month", () => {
    const paidAt = new Date("2025-08-31T00:00:00Z");
    const end = computeEditWindowEnd({ paidAt, weddingDate: "2030-01-01" });
    // August 31 + 18 months -> February 2027 has 28 days
    expect(end.toISOString()).toBe("2027-02-28T00:00:00.000Z");
  });

  it("rejects an invalid wedding date", () => {
    expect(() =>
      computeEditWindowEnd({ paidAt: new Date(), weddingDate: "2026-02-30" }),
    ).toThrow();
  });
});

describe("isWithinEditWindow", () => {
  const endsAt = new Date("2026-12-15T00:00:00Z");

  it("is open before the end", () => {
    expect(isWithinEditWindow(new Date("2026-12-14T23:59:59Z"), endsAt)).toBe(true);
  });

  it("is closed at the end", () => {
    expect(isWithinEditWindow(endsAt, endsAt)).toBe(false);
  });
});
