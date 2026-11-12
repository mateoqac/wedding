import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const ADMIN_URL = "postgres://wedding:wedding@localhost:5433/postgres";
const E2E_URL = "postgres://wedding:wedding@localhost:5433/wedding_e2e";

/** Run before Playwright starts its web servers (they hold pg-boss connections). Recreates an isolated, migrated database and empties the dev outbox/storage before E2E runs. */
async function resetDatabase() {
  const admin = postgres(ADMIN_URL, { max: 1 });
  await admin.unsafe("drop database if exists wedding_e2e with (force)");
  await admin.unsafe("create database wedding_e2e");
  await admin.end();

  const client = postgres(E2E_URL, { max: 1 });
  await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
  await client.end();

  await rm(".data/e2e", { recursive: true, force: true });
}

await resetDatabase();
