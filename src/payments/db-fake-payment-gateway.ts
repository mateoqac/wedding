import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { fakeGatewayPayments } from "@/db/schema";
import { SIGNATURE_HEADER } from "./fake-payment-gateway";
import type { CheckoutRequest, GatewayPayment, PaymentGateway, WebhookRequest } from "./payment-gateway";
import type { PaymentStatus } from "./payment-status";

/**
 * Fake gateway for demo deployments. Same behaviour as FakePaymentGateway, but payments
 * live in Postgres because serverless instances share no memory. Never real money.
 */
export class DbFakePaymentGateway implements PaymentGateway {
  readonly provider = "fake";

  constructor(
    private readonly db: Database,
    private readonly secret = "fake-secret",
  ) {}

  async createCheckout(request: CheckoutRequest) {
    const providerRef = `fake_${randomUUID()}`;
    await this.db.insert(fakeGatewayPayments).values({
      providerRef,
      invitationId: request.invitationId,
      amountClp: request.amountClp,
      raw: { request },
    });
    return { providerRef, redirectUrl: `${request.returnUrl}?ref=${providerRef}` };
  }

  async getPayment(providerRef: string): Promise<GatewayPayment | null> {
    const [row] = await this.db.select().from(fakeGatewayPayments).where(eq(fakeGatewayPayments.providerRef, providerRef));
    if (!row) return null;
    return { providerRef, invitationId: row.invitationId, amountClp: row.amountClp, status: row.status, raw: row.raw };
  }

  async verifyWebhook({ headers, body }: WebhookRequest) {
    if (headers[SIGNATURE_HEADER] !== this.secret) return null;
    const { providerRef } = JSON.parse(body) as { providerRef?: unknown };
    return typeof providerRef === "string" ? providerRef : null;
  }

  /** Used by the demo checkout page to approve or reject a payment. */
  async setStatus(providerRef: string, status: PaymentStatus) {
    const updated = await this.db
      .update(fakeGatewayPayments)
      .set({ status })
      .where(eq(fakeGatewayPayments.providerRef, providerRef))
      .returning({ ref: fakeGatewayPayments.providerRef });
    if (!updated.length) throw new Error(`Unknown payment ${providerRef}`);
  }
}
