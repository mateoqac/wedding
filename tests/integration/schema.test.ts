import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exports, invitations, payments } from "@/db/schema";
import { createTestDatabase } from "./test-database";

let database: Awaited<ReturnType<typeof createTestDatabase>>;

beforeAll(async () => {
  database = await createTestDatabase();
});

afterAll(async () => {
  await database?.drop();
});

async function insertInvitation(editTokenHash: string) {
  const [row] = await database.db
    .insert(invitations)
    .values({
      editTokenHash,
      templateId: "clasico-marco-doble",
      templateVersion: 1,
      data: {},
      options: {},
    })
    .returning();
  return row;
}

/** Drizzle wraps driver errors; the Postgres error is the cause. */
async function postgresErrorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause;
    return cause?.code ?? (error as { code?: string }).code;
  }
}

describe("database schema", () => {
  it("creates every table from the migrations", async () => {
    const rows = await database.client<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`;
    expect(rows.map((row) => row.table_name)).toEqual([
      "demo_outbox",
      "exports",
      "fake_gateway_payments",
      "invitations",
      "magic_link_tokens",
      "payments",
      "rate_limits",
      "sessions",
      "users",
    ]);
  });

  it("starts a new invitation as draft", async () => {
    const invitation = await insertInvitation("token-draft");
    expect(invitation.status).toBe("draft");
  });

  it("rejects a duplicate payment provider_ref (idempotent webhooks)", async () => {
    const invitation = await insertInvitation("token-payments");
    const payment = {
      invitationId: invitation.id,
      provider: "fake",
      providerRef: "ref-1",
      amountClp: 9990,
    };
    await database.db.insert(payments).values(payment);
    expect(await postgresErrorCode(database.db.insert(payments).values(payment))).toBe("23505");
  });

  it("rejects a non-positive CLP amount", async () => {
    const invitation = await insertInvitation("token-amount");
    const code = await postgresErrorCode(
      database.db.insert(payments).values({
        invitationId: invitation.id,
        provider: "fake",
        providerRef: "ref-zero",
        amountClp: 0,
      }),
    );
    expect(code).toBe("23514");
  });

  it("rejects a duplicate export for the same invitation, format and content hash", async () => {
    const invitation = await insertInvitation("token-exports");
    const row = {
      invitationId: invitation.id,
      format: "print-pdf" as const,
      contentHash: "abc",
      r2Key: "exports/a.pdf",
    };
    await database.db.insert(exports).values(row);
    expect(await postgresErrorCode(database.db.insert(exports).values(row))).toBe("23505");
    await database.db.insert(exports).values({ ...row, format: "png", r2Key: "exports/a.png" });
  });
});
