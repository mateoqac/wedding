import { describe, expect, it } from "vitest";
import { deriveInvitationStatus, nextPaymentStatus } from "./payment-status";

describe("deriveInvitationStatus", () => {
  it("is draft without payments", () => {
    expect(deriveInvitationStatus([])).toBe("draft");
  });

  it("is paid with an approved payment", () => {
    expect(deriveInvitationStatus(["rejected", "approved"])).toBe("paid");
  });

  it.each(["pending", "rejected", "refunded", "charged_back"] as const)(
    "is draft when the only payment is %s",
    (status) => {
      expect(deriveInvitationStatus([status])).toBe("draft");
    },
  );
});

describe("nextPaymentStatus", () => {
  it("accepts the first status for a new payment", () => {
    expect(nextPaymentStatus(undefined, "approved")).toBe("approved");
  });

  it.each([
    ["pending", "approved"],
    ["pending", "rejected"],
    ["approved", "refunded"],
    ["approved", "charged_back"],
  ] as const)("moves from %s to %s", (current, incoming) => {
    expect(nextPaymentStatus(current, incoming)).toBe(incoming);
  });

  it.each([
    ["approved", "pending"],
    ["refunded", "approved"],
    ["rejected", "approved"],
    ["charged_back", "approved"],
  ] as const)("keeps %s when a late %s arrives", (current, incoming) => {
    expect(nextPaymentStatus(current, incoming)).toBe(current);
  });
});
