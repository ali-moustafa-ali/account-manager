import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DbClient = ReturnType<typeof createDb>;

declare global {
  // eslint-disable-next-line no-var
  var __dbClient: DbClient | undefined;
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

let cached: DbClient | undefined;

function getDb(): DbClient {
  if (cached) return cached;
  if (globalThis.__dbClient) {
    cached = globalThis.__dbClient;
    return cached;
  }
  cached = createDb();
  if (process.env.NODE_ENV !== "production") globalThis.__dbClient = cached;
  return cached;
}

/**
 * Lazy-init Drizzle client. Wrapped in a Proxy so importing this module
 * doesn't open a connection — useful for build-time analysis where
 * DATABASE_URL may not be set. The connection is opened only when a
 * property of `db` is actually accessed (e.g. `db.select(...)`).
 */
export const db: DbClient = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});
