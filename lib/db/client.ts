import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __dbClient: ReturnType<typeof createDb> | undefined;
  // eslint-disable-next-line no-var
  var __pgClient: ReturnType<typeof postgres> | undefined;
}

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Did you create .env.local?");
  }
  const pg =
    globalThis.__pgClient ??
    postgres(url, {
      prepare: false, // required for Supabase pooled (port 6543, pgBouncer transaction mode)
      ssl: "require", // Supabase requires SSL even when the URL omits ?sslmode=require
    });
  if (process.env.NODE_ENV !== "production") globalThis.__pgClient = pg;
  return drizzle(pg, { schema });
}

export const db: ReturnType<typeof createDb> = globalThis.__dbClient ?? createDb();
if (process.env.NODE_ENV !== "production") globalThis.__dbClient = db;
