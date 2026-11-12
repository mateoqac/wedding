import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invitations, payments } from "@/db/schema";
import { FakePaymentGateway } from "@/payments/fake-payment-gateway";
import { deriveInvitationStatus } from "@/payments/payment-status";
import { createPaymentService, type PaymentService } from "@/payments/payment-service";
import { createTestDatabase } from "./test-database";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let gateway: FakePaymentGateway;
let service: PaymentService;

const NOW = new Date("2026-10-01T12:00:00Z");

const invitationData = {
  couple: { partnerOne: "Álvaro Galán Piazzano", partnerTwo: "Francisca Carmona Redard" },
  ceremony: { date: "2026-11-14" },
};

beforeAll(async () => {
  database = await createTestDatabase();
});

afterAll(async () => {
  await database?.drop();
});

beforeEach(() => {
  gateway = new FakePaymentGateway();
  service = createPaymentService({ db: database.db, gateway, now: () => NOW });
});

async function newInvitationWithCheckout() {
  const [invitation] = await database.db
    .insert(invitations)
    .values({
      editTokenHash: `token-${crypto.randomUUID()}`,
      templateId: "clasico-marco-doble",
      templateVersion: 1,
      data: invitationData,
      options: {},
    })
    .returning();
  const { providerRef } = await gateway.createCheckout({
    invitationId: invitation.id,
    amountClp: 9990,
    email: "pareja@example.com",
    returnUrl: "https://example.com/vuelta",
  });
  return { invitationId: invitation.id, providerRef };
}

async function readInvitation(id: string) {
  const [row] = await database.db.select().from(invitations).where(eq(invitations.id, id));
  return row;
}

async function readPayments(invitationId: string) {
  return database.db.select().from(payments).where(eq(payments.invitationId, invitationId));
}

describe("payment service", () => {
  it("marks the invitation paid, locks the couple names and opens the edit window", async () => {
    const { invitationId, providerRef } = await newInvitationWithCheckout();
    gateway.setStatus(providerRef, "approved");

    const result = await service.handleWebhook(gateway.webhookFor(providerRef));

    expect(result).toBe("processed");
    const invitation = await readInvitation(invitationId);
    expect(invitation.status).toBe("paid");
    expect(invitation.paidCoupleNames).toEqual([
      "Álvaro Galán Piazzano",
      "Francisca Carmona Redard",
    ]);
    expect(invitation.editWindowEndsAt?.toISOString()).toBe("2026-12-15T00:00:00.000Z");
  });

  it("stores a duplicate webhook only once", async () => {
    const { invitationId, providerRef } = await newInvitationWithCheckout();
    gateway.setStatus(providerRef, "approved");

    await service.handleWebhook(gateway.webhookFor(providerRef));
    await service.handleWebhook(gateway.webhookFor(providerRef));

    const rows = await readPayments(invitationId);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("approved");
  });

  it("ignores a webhook that fails verification", async () => {
    const { invitationId, providerRef } = await newInvitationWithCheckout();
    gateway.setStatus(providerRef, "approved");

    const result = await service.handleWebhook(gateway.webhookFor(providerRef, false));

    expect(result).toBe("rejected");
    expect(await readPayments(invitationId)).toHaveLength(0);
    expect((await readInvitation(invitationId)).status).toBe("draft");
  });

  it("does not move an approved payment back to pending", async () => {
    const { invitationId, providerRef } = await newInvitationWithCheckout();
    gateway.setStatus(providerRef, "approved");
    await service.handleWebhook(gateway.webhookFor(providerRef));

    gateway.setStatus(providerRef, "pending");
    await service.handleWebhook(gateway.webhookFor(providerRef));

    expect((await readPayments(invitationId))[0].status).toBe("approved");
    expect((await readInvitation(invitationId)).status).toBe("paid");
  });

  it.each(["refunded", "charged_back"] as const)(
    "returns the invitation to draft when the payment is %s",
    async (status) => {
      const { invitationId, providerRef } = await newInvitationWithCheckout();
      gateway.setStatus(providerRef, "approved");
      await service.handleWebhook(gateway.webhookFor(providerRef));

      gateway.setStatus(providerRef, status);
      await service.handleWebhook(gateway.webhookFor(providerRef));

      expect((await readPayments(invitationId))[0].status).toBe(status);
      expect((await readInvitation(invitationId)).status).toBe("draft");
    },
  );

  it("reconciles a payment without a webhook by querying the gateway", async () => {
    const { invitationId, providerRef } = await newInvitationWithCheckout();
    gateway.setStatus(providerRef, "approved");

    await service.reconcile(providerRef);

    expect((await readInvitation(invitationId)).status).toBe("paid");
  });

  it("keeps the cached invitation status equal to the derivation from payments", async () => {
    const { invitationId, providerRef } = await newInvitationWithCheckout();
    for (const status of ["pending", "approved", "refunded"] as const) {
      gateway.setStatus(providerRef, status);
      await service.handleWebhook(gateway.webhookFor(providerRef));

      const rows = await readPayments(invitationId);
      const invitation = await readInvitation(invitationId);
      expect(invitation.status).toBe(deriveInvitationStatus(rows.map((row) => row.status)));
    }
  });
});
