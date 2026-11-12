import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAuthService } from "@/auth/auth-service";
import { FakeEmailSender } from "@/auth/fake-email-sender";
import { hashToken } from "@/auth/tokens";
import { invitations, payments, rateLimits, users } from "@/db/schema";
import { createInvitationService, type InvitationService } from "@/invitations/invitation-service";
import { FakePaymentGateway } from "@/payments/fake-payment-gateway";
import { createPaymentService } from "@/payments/payment-service";
import { createRateLimiter } from "@/rate-limits/rate-limiter";
import { fixtures } from "@/templates/clasico-marco-doble/v1/fixtures";
import { defaultOptions } from "@/templates/clasico-marco-doble/v1/options";
import { createTestDatabase } from "./test-database";

const DAY = 24 * 60 * 60 * 1000;
let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
let gateway: FakePaymentGateway;
let email: FakeEmailSender;
let clock: Date;
let service: InvitationService;

beforeAll(async () => {
  testDb = await createTestDatabase();
});
afterAll(async () => {
  await testDb.drop();
});
beforeEach(async () => {
  await testDb.db.delete(payments);
  await testDb.db.delete(invitations);
  await testDb.db.delete(users);
  await testDb.db.delete(rateLimits);
  clock = new Date("2026-11-12T12:00:00Z");
  gateway = new FakePaymentGateway();
  email = new FakeEmailSender();
  const now = () => clock;
  const auth = createAuthService({ db: testDb.db, email, baseUrl: "https://partes.example", now });
  const paymentService = createPaymentService({ db: testDb.db, gateway, now });
  service = createInvitationService({
    db: testDb.db,
    auth,
    gateway,
    paymentService,
    rateLimiter: createRateLimiter({ db: testDb.db, now }),
    baseUrl: "https://partes.example",
    priceClp: 9990,
    now,
  });
});

async function paidDraft() {
  const draft = await service.createDraft({ templateId: "clasico-marco-doble", ip: "1.1.1.1" });
  if (draft.status !== "created") throw new Error("draft not created");
  const access = { editToken: draft.editToken };
  await service.saveDraft(draft.invitationId, access, { data: fixtures.typical, options: defaultOptions });
  const checkout = await service.startCheckout(draft.invitationId, access, " Ana@Example.CL ");
  if (checkout.status !== "redirect") throw new Error("checkout failed");
  const ref = new URL(checkout.url).searchParams.get("ref") as string;
  gateway.setStatus(ref, "approved");
  await service.completeCheckout(ref);
  return { ...draft, access, ref };
}

describe("drafts", () => {
  it("creates an anonymous draft with the template's first fixture-free defaults and a hashed edit token", async () => {
    const draft = await service.createDraft({ templateId: "clasico-marco-doble", ip: "1.1.1.1" });
    expect(draft.status).toBe("created");
    if (draft.status !== "created") return;
    const [row] = await testDb.db.select().from(invitations).where(eq(invitations.id, draft.invitationId));
    expect(row).toMatchObject({ userId: null, templateVersion: 1, status: "draft", editTokenHash: hashToken(draft.editToken) });
    expect(row.options).toEqual(defaultOptions);
  });

  it("rejects unknown templates and rate-limits draft creation per IP", async () => {
    expect(await service.createDraft({ templateId: "nope", ip: "1.1.1.1" })).toEqual({ status: "unknown_template" });
    for (let i = 0; i < 20; i++) await service.createDraft({ templateId: "clasico-marco-doble", ip: "2.2.2.2" });
    expect(await service.createDraft({ templateId: "clasico-marco-doble", ip: "2.2.2.2" })).toEqual({ status: "rate_limited" });
  });

  it("only lets the edit-token holder or the owner access a draft", async () => {
    const draft = await service.createDraft({ templateId: "clasico-marco-doble", ip: "1.1.1.1" });
    if (draft.status !== "created") return;
    expect(await service.load(draft.invitationId, { editToken: draft.editToken })).not.toBeNull();
    expect(await service.load(draft.invitationId, { editToken: "wrong" })).toBeNull();
    expect(await service.load(draft.invitationId, {})).toBeNull();
  });

  it("validates data on save and records activity", async () => {
    const draft = await service.createDraft({ templateId: "clasico-marco-doble", ip: "1.1.1.1" });
    if (draft.status !== "created") return;
    const access = { editToken: draft.editToken };
    const bad = await service.saveDraft(draft.invitationId, access, { data: { couple: {} }, options: defaultOptions });
    expect(bad.status).toBe("invalid");
    clock = new Date(clock.getTime() + 1000);
    expect(await service.saveDraft(draft.invitationId, access, { data: fixtures.typical, options: defaultOptions })).toEqual({ status: "saved" });
    const [row] = await testDb.db.select().from(invitations).where(eq(invitations.id, draft.invitationId));
    expect(row.data).toEqual(fixtures.typical);
    expect(row.lastActivityAt).toEqual(clock);
  });
});

describe("checkout", () => {
  it("refuses checkout for incomplete data and invalid emails", async () => {
    const draft = await service.createDraft({ templateId: "clasico-marco-doble", ip: "1.1.1.1" });
    if (draft.status !== "created") return;
    const access = { editToken: draft.editToken };
    expect(await service.startCheckout(draft.invitationId, access, "ana@example.cl")).toEqual({ status: "incomplete" });
    await service.saveDraft(draft.invitationId, access, { data: fixtures.typical, options: defaultOptions });
    expect(await service.startCheckout(draft.invitationId, access, "no-es-email")).toEqual({ status: "invalid_email" });
  });

  it("on approval marks paid, attaches the owner by email and sends the access link once", async () => {
    const { invitationId, ref } = await paidDraft();
    const [row] = await testDb.db.select().from(invitations).where(eq(invitations.id, invitationId));
    const [user] = await testDb.db.select().from(users);
    expect(row.status).toBe("paid");
    expect(user.email).toBe("ana@example.cl");
    expect(row.userId).toBe(user.id);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].to).toBe("ana@example.cl");

    await service.completeCheckout(ref);
    expect(email.sent).toHaveLength(1);
    const [payment] = await testDb.db.select().from(payments);
    expect(payment.amountClp).toBe(9990);
  });

  it("lets the owner's session access the invitation", async () => {
    const { invitationId } = await paidDraft();
    const [user] = await testDb.db.select().from(users);
    expect(await service.load(invitationId, { userId: user.id })).not.toBeNull();
  });
});

describe("paid edits", () => {
  it("keeps names locked by the anti-reuse rule but allows small fixes", async () => {
    const { invitationId, access } = await paidDraft();
    const fix = { ...fixtures.typical, couple: { ...fixtures.typical.couple, partnerTwo: "Francisca Carmona Redarde" } };
    expect(await service.saveDraft(invitationId, access, { data: fix, options: defaultOptions })).toEqual({ status: "saved" });
    const reuse = { ...fixtures.typical, couple: { partnerOne: "Pedro Soto", partnerTwo: "Camila Rojas" } };
    expect(await service.saveDraft(invitationId, access, { data: reuse, options: defaultOptions })).toEqual({ status: "names_locked" });
  });

  it("rejects edits after the edit window closes", async () => {
    const { invitationId, access } = await paidDraft();
    clock = new Date(clock.getTime() + 600 * DAY);
    expect(await service.saveDraft(invitationId, access, { data: fixtures.typical, options: defaultOptions })).toEqual({ status: "edit_window_closed" });
  });
});
