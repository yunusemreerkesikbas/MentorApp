import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { Pool } from "pg";

/**
 * Vitest globalSetup: bring the TEST database to the latest migration state
 * before any e2e file runs (same SQL as production — no separate test schema),
 * then clear the global rows an INTERRUPTED earlier run left behind.
 *
 * Specs clean up in `afterAll`, which never runs after a Ctrl+C or a crash. The residue lives
 * on in the shared mentor_test database and breaks later runs: a promotion left `is_active`
 * shows up as a second live offer, and a leftover flag keeps a module switched on for every
 * spec after it. Both are safe to wipe wholesale — no migration seeds either table.
 */
export default async function setup(): Promise<void> {
  const url =
    process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_test";
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: path.join(__dirname, "../drizzle"),
    });
    const client = await pool.connect();
    try {
      await client.query("begin");
      // config_overrides has FORCE ROW LEVEL SECURITY: without the SERVICE role the delete
      // matches nothing and fails silently.
      await client.query("select set_config('app.role','SERVICE',true)");
      await client.query("delete from config_overrides");
      await client.query("update promotions set is_active = false where name like 'e2e %'");
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
