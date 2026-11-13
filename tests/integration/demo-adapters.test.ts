import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DbOutboxEmailSender, latestDemoEmail } from "@/auth/db-outbox-email-sender";
import { demoOutbox, fakeGatewayPayments } from "@/db/schema";
import { DbFakePaymentGateway } from "@/payments/db-fake-payment-gateway";
import { SIGNATURE_HEADER } from "@/payments/fake-payment-gateway";
import { createTestDatabase } from "./test-database";

let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
const invitationId = "11111111-1111-4111-8111-111111111111";

beforeAll(async () => {
  testDb = await createTestDatabase();
});
afterAll(async () => {
  await testDb.drop();
});
beforeEach(async () => {
  await testDb.db.delete(fakeGatewayPayments);
  await testDb.db.delete(demoOutbox);
});

describe("database-backed fake gateway (serverless-safe)", () => {
  it("keeps checkouts across instances and reports status changes", async () => {
    const a = new DbFakePaymentGateway(testDb.db, "secret");
    const b = new DbFakePaymentGateway(testDb.db, "secret");
    const { providerRef, redirectUrl } = await a.createCheckout({
      invitationId,
      amountClp: 9990,
      email: "ana@example.cl",
      returnUrl: "https://partes.example/checkout/retorno",
    });
    expect(redirectUrl).toBe(`https://partes.example/checkout/retorno?ref=${providerRef}`);
    expect(await b.getPayment(providerRef)).toMatchObject({ providerRef, invitationId, amountClp: 9990, status: "pending" });

    await b.setStatus(providerRef, "approved");
    expect((await a.getPayment(providerRef))?.status).toBe("approved");
    expect(await a.getPayment("missing")).toBeNull();
  });

  it("rejects setStatus for unknown payments", async () => {
    const gateway = new DbFakePaymentGateway(testDb.db, "secret");
    await expect(gateway.setStatus("missing", "approved")).rejects.toThrow("Unknown payment missing");
  });

  it("verifies webhooks with the shared secret only", async () => {
    const gateway = new DbFakePaymentGateway(testDb.db, "secret");
    const body = JSON.stringify({ providerRef: "fake_1" });
    expect(await gateway.verifyWebhook({ headers: { [SIGNATURE_HEADER]: "secret" }, body })).toBe("fake_1");
    expect(await gateway.verifyWebhook({ headers: { [SIGNATURE_HEADER]: "nope" }, body })).toBeNull();
  });
});

describe("demo outbox", () => {
  it("stores emails and returns the latest one per recipient", async () => {
    const sender = new DbOutboxEmailSender(testDb.db);
    await sender.send({ to: "ana@example.cl", subject: "1", text: "primero" });
    await new Promise((r) => setTimeout(r, 10));
    await sender.send({ to: "ana@example.cl", subject: "2", text: "segundo" });
    await sender.send({ to: "otro@example.cl", subject: "3", text: "otro" });

    expect(await latestDemoEmail(testDb.db, "ana@example.cl")).toMatchObject({ subject: "2", text: "segundo" });
    expect(await latestDemoEmail(testDb.db, "nadie@example.cl")).toBeNull();
  });
});
