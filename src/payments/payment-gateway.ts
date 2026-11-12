import type { PaymentStatus } from "./payment-status";

/** A payment as reported by the gateway itself (never taken from an unverified webhook body). */
export interface GatewayPayment {
  providerRef: string;
  invitationId: string;
  amountClp: number;
  status: PaymentStatus;
  raw: unknown;
}

export interface CheckoutRequest {
  invitationId: string;
  amountClp: number;
  email: string;
  returnUrl: string;
}

export interface WebhookRequest {
  headers: Record<string, string>;
  body: string;
}

/**
 * Port for the payment gateway (design §1). The concrete gateway (Flow, Mercado Pago,
 * Webpay) is still undecided; each one becomes an adapter implementing this interface.
 */
export interface PaymentGateway {
  readonly provider: string;
  createCheckout(request: CheckoutRequest): Promise<{ providerRef: string; redirectUrl: string }>;
  /** Queries the gateway directly for the current state of a payment. */
  getPayment(providerRef: string): Promise<GatewayPayment | null>;
  /** Returns the payment reference of an authentic webhook, or null when verification fails. */
  verifyWebhook(request: WebhookRequest): Promise<string | null>;
}
