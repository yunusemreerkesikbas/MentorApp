import { neon, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

/**
 * Neon connection — DUAL DRIVER (§8 decision).
 *
 * On Neon serverless, a single driver doesn't fit every need:
 *  1) `neon-http` (stateless HTTP): ideal for simple read/write, scale-to-zero friendly.
 *     BUT each query is a separate HTTP request → it doesn't share the session GUC → RLS-session is UNRELIABLE.
 *  2) `neon-serverless` (WebSocket Pool): transaction-scoped → `SET app.user_id` + query on the
 *     same connection → **RLS double belt** works. Writes + RLS-requiring queries go here.
 *     The queue (Cron worker) connection also uses this.
 *
 * Behavioral data in Postgres (RLS); pgvector is content only (§8).
 */

/** Stateless HTTP driver — simple reads (that don't need an RLS-session). */
export function createDb(connectionString: string) {
  const sql = neon(connectionString);
  return drizzleHttp(sql, { schema });
}

/** Transaction-scoped WebSocket Pool — RLS-session, writes, the queue worker. */
export function createDbPool(connectionString: string) {
  const pool = new Pool({ connectionString });
  return drizzlePool(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;
export type DbPool = ReturnType<typeof createDbPool>;
export { schema };
