import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>["db"];

/**
 * `serverless`: one connection per instance and no prepared statements, as required by
 * pooled connection strings (Neon pooler / PgBouncer) on Vercel.
 */
export function createDatabase(url: string, { serverless = false }: { serverless?: boolean } = {}) {
  const client = serverless ? postgres(url, { max: 1, prepare: false, idle_timeout: 20 }) : postgres(url);
  return { db: drizzle(client, { schema }), client };
}
