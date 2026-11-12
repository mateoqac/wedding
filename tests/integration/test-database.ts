import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { createDatabase } from "@/db/client";

const ADMIN_URL =
  process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://wedding:wedding@localhost:5433/postgres";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

/** Creates an isolated, fully migrated database for one test file and drops it afterwards. */
export async function createTestDatabase() {
  const name = `wi_test_${randomBytes(6).toString("hex")}`;
  const admin = postgres(ADMIN_URL, { max: 1 });
  await admin.unsafe(`create database ${name}`);

  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  const { db, client } = createDatabase(url.toString());
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  return {
    db,
    client,
    url: url.toString(),
    async drop() {
      await client.end();
      await admin.unsafe(`drop database if exists ${name} with (force)`);
      await admin.end();
    },
  };
}
