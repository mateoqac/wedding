import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invitations, payments, rateLimits } from "@/db/schema";
import { cleanupAnonymousDrafts } from "@/invitations/draft-cleanup";
import { LIMITS, createRateLimiter } from "@/rate-limits/rate-limiter";
import { createTestDatabase } from "./test-database";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
let clock: Date;

beforeAll(async () => {
  testDb = await createTestDatabase();
});
afterAll(async () => {
  await testDb.drop();
});
beforeEach(async () => {
  await testDb.db.delete(rateLimits);
  await testDb.db.delete(payments);
  await testDb.db.delete(invitations);
  clock = new Date("2026-11-12T12:30:00Z");
});

describe("rate limiter", () => {
  it("uses the agreed limits", () => {
    expect(LIMITS).toEqual({
      accessLinkPerEmail: 5,
      accessLinkPerIp: 20,
      draftPerIp: 20,
      previewPerDraft: 600,
      exportPerInvitation: 30,
    });
  });

  it("allows up to the limit within a fixed one-hour window, then refuses", async () => {
    const limiter = createRateLimiter({ db: testDb.db, now: () => clock });
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await limiter.hit("access:email:ana@example.cl", 5));
    expect(results).toEqual([true, true, true, true, true, false]);

    clock = new Date("2026-11-12T13:00:00Z");
    expect(await limiter.hit("access:email:ana@example.cl", 5)).toBe(true);
  });

  it("counts concurrent hits exactly", async () => {
    const limiter = createRateLimiter({ db: testDb.db, now: () => clock });
    const results = await Promise.all(Array.from({ length: 10 }, () => limiter.hit("draft:ip:1.2.3.4", 4)));
    expect(results.filter(Boolean)).toHaveLength(4);
  });

  it("access-link hook enforces both the email and the IP limits", async () => {
    const limiter = createRateLimiter({ db: testDb.db, now: () => clock });
    for (let i = 0; i < 5; i++) {
      expect(await limiter.allowAccessLinkEmail({ email: "ana@example.cl", ip: "1.1.1.1" })).toBe(true);
    }
    expect(await limiter.allowAccessLinkEmail({ email: "ana@example.cl", ip: "1.1.1.1" })).toBe(false);
    for (let i = 0; i < 14; i++) {
      expect(await limiter.allowAccessLinkEmail({ email: `u${i}@example.cl`, ip: "1.1.1.1" })).toBe(true);
    }
    expect(await limiter.allowAccessLinkEmail({ email: "otra@example.cl", ip: "1.1.1.1" })).toBe(false);
  });
});

describe("draft cleanup", () => {
  async function insert(values: { userId?: null; lastActivityAt: Date; status?: "draft" | "paid" }) {
    const [row] = await testDb.db
      .insert(invitations)
      .values({
        editTokenHash: `t-${crypto.randomUUID()}`,
        templateId: "clasico-marco-doble",
        templateVersion: 1,
        data: {},
        options: {},
        status: values.status ?? "draft",
        lastActivityAt: values.lastActivityAt,
      })
      .returning();
    return row.id;
  }

  it("deletes only anonymous drafts inactive for 30 days or more", async () => {
    const stale = await insert({ lastActivityAt: new Date(clock.getTime() - 30 * DAY) });
    const fresh = await insert({ lastActivityAt: new Date(clock.getTime() - 29 * DAY) });
    const paid = await insert({ lastActivityAt: new Date(clock.getTime() - 90 * DAY), status: "paid" });

    expect(await cleanupAnonymousDrafts(testDb.db, clock)).toBe(1);
    const left = (await testDb.db.select().from(invitations)).map((r) => r.id).sort();
    expect(left).toEqual([fresh, paid].sort());
    expect(left).not.toContain(stale);
  });

  it("keeps a stale draft that has a payment row", async () => {
    const id = await insert({ lastActivityAt: new Date(clock.getTime() - 40 * DAY) });
    await testDb.db.insert(payments).values({
      invitationId: id,
      provider: "fake",
      providerRef: `ref-${id}`,
      amountClp: 9990,
      status: "refunded",
    });
    expect(await cleanupAnonymousDrafts(testDb.db, clock)).toBe(0);
  });
});
