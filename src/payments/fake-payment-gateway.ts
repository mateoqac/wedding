import { randomUUID } from "node:crypto";
import type {
  CheckoutRequest,
  GatewayPayment,
  PaymentGateway,
  WebhookRequest,
} from "./payment-gateway";
import type { PaymentStatus } from "./payment-status";

const SIGNATURE_HEADER = "x-fake-signature";

/**
 * In-memory gateway for tests and local development. Webhooks are authentic only when they
 * carry the shared secret in `x-fake-signature`, mimicking a real gateway's signature check.
 */
export class FakePaymentGateway implements PaymentGateway {
  readonly provider = "fake";
  private readonly payments = new Map<string, GatewayPayment>();

  constructor(private readonly secret = "fake-secret") {}

  async createCheckout(request: CheckoutRequest) {
    const providerRef = `fake_${randomUUID()}`;
    this.payments.set(providerRef, {
      providerRef,
      invitationId: request.invitationId,
      amountClp: request.amountClp,
      status: "pending",
      raw: { request },
    });
    return { providerRef, redirectUrl: `${request.returnUrl}?ref=${providerRef}` };
  }

  async getPayment(providerRef: string) {
    return this.payments.get(providerRef) ?? null;
  }

  async verifyWebhook({ headers, body }: WebhookRequest) {
    if (headers[SIGNATURE_HEADER] !== this.secret) return null;
    const { providerRef } = JSON.parse(body) as { providerRef?: unknown };
    return typeof providerRef === "string" ? providerRef : null;
  }

  /** Test helper: changes the state the gateway reports for a payment. */
  setStatus(providerRef: string, status: PaymentStatus) {
    const payment = this.payments.get(providerRef);
    if (!payment) throw new Error(`Unknown payment ${providerRef}`);
    this.payments.set(providerRef, { ...payment, status });
  }

  /** Test helper: builds a webhook request as the gateway would send it. */
  webhookFor(providerRef: string, signed = true): WebhookRequest {
    return {
      headers: signed ? { [SIGNATURE_HEADER]: this.secret } : {},
      body: JSON.stringify({ providerRef }),
    };
  }
}
