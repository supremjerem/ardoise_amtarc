import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/env";

import * as schema from "./schema";

/*
 * In development Next.js reloads modules on every edit. Without this global
 * cache each reload would open a new pool and Postgres would eventually
 * refuse connections.
 */
const globalCache = globalThis as unknown as { ardoiseSql?: postgres.Sql };

const sql =
  globalCache.ardoiseSql ??
  postgres(env.DATABASE_URL, {
    /*
     * Managed Postgres providers put a pooler (PgBouncer) in front of the
     * database, and that does not support prepared statements in transaction
     * mode. Disabling them keeps the configuration portable.
     */
    prepare: false,
    max: env.NODE_ENV === "production" ? 5 : 2,
    idle_timeout: 20,
  });

if (env.NODE_ENV !== "production") globalCache.ardoiseSql = sql;

export const db = drizzle(sql, { schema });
export { schema, sql };
