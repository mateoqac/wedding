import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAuthService, type AuthService } from "@/auth/auth-service";
import { FakeEmailSender } from "@/auth/fake-email-sender";
import { hashToken } from "@/auth/tokens";
import { magicLinkTokens, sessions, users } from "@/db/schema";
import { createTestDatabase } from "./test-database";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
let email: FakeEmailSender;
let clock: Date;
let auth: AuthService;

function tokenFromLastEmail() {
  const link = email.sent.at(-1)?.text.match(/https:\/\/\S+/)?.[0];
  if (!link) throw new Error("no access link sent");
  const token = new URL(link).searchParams.get("token");
  if (!token) throw new Error("no token in link");
  return token;
}

beforeAll(async () => {
  testDb = await createTestDatabase();
});

afterAll(async () => {
  await testDb.drop();
});

beforeEach(async () => {
  await testDb.db.delete(sessions);
  await testDb.db.delete(magicLinkTokens);
  await testDb.db.delete(users);
  email = new FakeEmailSender();
  clock = new Date("2026-11-12T12:00:00Z");
  auth = createAuthService({
    db: testDb.db,
    email,
    baseUrl: "https://partes.example",
    now: () => clock,
  });
});

describe("access link", () => {
  it("emails a single link and stores only the token hash", async () => {
    const result = await auth.requestAccessLink({ email: " Ana@Example.CL ", ip: "1.2.3.4" });

    expect(result).toBe("sent");
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].to).toBe("ana@example.cl");
    const token = tokenFromLastEmail();
    const rows = await testDb.db.select().from(magicLinkTokens);
    expect(rows).toEqual([
      expect.objectContaining({
        tokenHash: hashToken(token),
        email: "ana@example.cl",
        expiresAt: new Date(clock.getTime() + 15 * MINUTE),
        usedAt: null,
      }),
    ]);
  });

  it("does not send nor store anything when the rate limit hook refuses", async () => {
    const calls: unknown[] = [];
    auth = createAuthService({
      db: testDb.db,
      email,
      baseUrl: "https://partes.example",
      now: () => clock,
      allowAccessLinkEmail: async (input) => {
        calls.push(input);
        return false;
      },
    });

    const result = await auth.requestAccessLink({ email: "Ana@example.cl", ip: "1.2.3.4" });

    expect(result).toBe("rate_limited");
    expect(calls).toEqual([{ email: "ana@example.cl", ip: "1.2.3.4" }]);
    expect(email.sent).toHaveLength(0);
    expect(await testDb.db.select().from(magicLinkTokens)).toHaveLength(0);
  });

  it("consumes a valid link once, creating the user and a 30-day session", async () => {
    await auth.requestAccessLink({ email: "ana@example.cl", ip: "1.2.3.4" });
    const token = tokenFromLastEmail();

    const result = await auth.consumeAccessLink(token);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.expiresAt).toEqual(new Date(clock.getTime() + 30 * DAY));
    const [user] = await testDb.db.select().from(users);
    expect(user.email).toBe("ana@example.cl");
    const [session] = await testDb.db.select().from(sessions);
    expect(session).toMatchObject({ idHash: hashToken(result.sessionToken), userId: user.id });
    const [link] = await testDb.db.select().from(magicLinkTokens);
    expect(link.usedAt).toEqual(clock);

    expect(await auth.consumeAccessLink(token)).toEqual({ status: "used" });
    expect(await testDb.db.select().from(sessions)).toHaveLength(1);
  });

  it("reuses the existing user for the same email", async () => {
    await auth.requestAccessLink({ email: "ana@example.cl", ip: "1.2.3.4" });
    await auth.consumeAccessLink(tokenFromLastEmail());
    await auth.requestAccessLink({ email: "ANA@example.cl", ip: "1.2.3.4" });
    await auth.consumeAccessLink(tokenFromLastEmail());

    expect(await testDb.db.select().from(users)).toHaveLength(1);
    expect(await testDb.db.select().from(sessions)).toHaveLength(2);
  });

  it("rejects an expired link without creating a session", async () => {
    await auth.requestAccessLink({ email: "ana@example.cl", ip: "1.2.3.4" });
    const token = tokenFromLastEmail();
    clock = new Date(clock.getTime() + 15 * MINUTE);

    expect(await auth.consumeAccessLink(token)).toEqual({ status: "expired" });
    expect(await testDb.db.select().from(sessions)).toHaveLength(0);
    expect(await testDb.db.select().from(users)).toHaveLength(0);
    const [link] = await testDb.db.select().from(magicLinkTokens);
    expect(link.usedAt).toBeNull();
  });

  it("rejects an unknown token", async () => {
    expect(await auth.consumeAccessLink("not-a-token")).toEqual({ status: "invalid" });
    expect(await testDb.db.select().from(sessions)).toHaveLength(0);
  });

  it("lets only one of two concurrent consumptions succeed", async () => {
    await auth.requestAccessLink({ email: "ana@example.cl", ip: "1.2.3.4" });
    const token = tokenFromLastEmail();

    const results = await Promise.all([auth.consumeAccessLink(token), auth.consumeAccessLink(token)]);

    expect(results.map((r) => r.status).sort()).toEqual(["ok", "used"]);
    expect(await testDb.db.select().from(sessions)).toHaveLength(1);
  });
});

describe("sessions", () => {
  async function signIn() {
    await auth.requestAccessLink({ email: "ana@example.cl", ip: "1.2.3.4" });
    const result = await auth.consumeAccessLink(tokenFromLastEmail());
    if (result.status !== "ok") throw new Error("sign-in failed");
    return result.sessionToken;
  }

  it("resolves a live session to its user", async () => {
    const token = await signIn();
    const [user] = await testDb.db.select().from(users);

    expect(await auth.getSessionUser(token)).toEqual({ id: user.id, email: "ana@example.cl" });
  });

  it("returns null for unknown or expired sessions", async () => {
    const token = await signIn();
    expect(await auth.getSessionUser("unknown")).toBeNull();

    clock = new Date(clock.getTime() + 30 * DAY);
    expect(await auth.getSessionUser(token)).toBeNull();
  });

  it("signs out by deleting the session", async () => {
    const token = await signIn();

    await auth.signOut(token);

    expect(await auth.getSessionUser(token)).toBeNull();
    expect(
      await testDb.db.select().from(sessions).where(eq(sessions.idHash, hashToken(token))),
    ).toHaveLength(0);
  });
});
