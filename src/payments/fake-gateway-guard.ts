import type { PaymentGateway } from "./payment-gateway";
import type { PaymentStatus } from "./payment-status";

/** Fake gateways (in-memory or database-backed) expose setStatus for the demo checkout page. */
export function isFakeGateway(
  gateway: PaymentGateway,
): gateway is PaymentGateway & { setStatus(ref: string, status: PaymentStatus): void | Promise<void> } {
  return gateway.provider === "fake" && typeof (gateway as { setStatus?: unknown }).setStatus === "function";
}
