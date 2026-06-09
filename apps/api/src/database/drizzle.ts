import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Single driver: node-postgres `pg` Pool (§8 decision).
 *
 * Works against BOTH local Postgres (docker) and Neon (wire-compatible) → dev/prod parity.
 * A pooled TCP connection naturally supports transactions + RLS session GUCs (`SET LOCAL`),
 * which the stateless neon-http driver could not. The API runs as a persistent Render
 * service (not edge), so an HTTP/edge driver brings no benefit here.
 */
export type Database = NodePgDatabase<typeof schema>;

/** Transaction handle type (for RLS-scoped work). */
export type DatabaseTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export function createDatabase(pool: Pool): Database {
  return drizzle(pool, { schema });
}

export { schema };
