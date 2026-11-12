export const PAYMENT_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "refunded",
  "charged_back",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type InvitationStatus = "draft" | "paid";

/**
 * `payments` is the single source of truth (design §4): an invitation is paid when at least
 * one of its payments is approved. Refunded or charged-back payments no longer count.
 */
export function deriveInvitationStatus(statuses: readonly PaymentStatus[]): InvitationStatus {
  return statuses.includes("approved") ? "paid" : "draft";
}

const ALLOWED_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ["approved", "rejected"],
  approved: ["refunded", "charged_back"],
  rejected: [],
  refunded: [],
  charged_back: [],
};

/**
 * Applies an incoming gateway status. Gateways retry and deliver out of order, so a status
 * that would move a payment backwards (e.g. a late `pending` after `approved`) is ignored.
 */
export function nextPaymentStatus(
  current: PaymentStatus | undefined,
  incoming: PaymentStatus,
): PaymentStatus {
  if (current === undefined || current === incoming) return incoming;
  return ALLOWED_TRANSITIONS[current].includes(incoming) ? incoming : current;
}
