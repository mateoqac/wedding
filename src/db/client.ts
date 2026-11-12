import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>["db"];

export function createDatabase(url: string) {
  const client = postgres(url);
  return { db: drizzle(client, { schema }), client };
}
