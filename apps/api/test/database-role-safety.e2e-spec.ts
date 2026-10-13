import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { assertRuntimeDatabaseRole } from "../src/database/database-role-safety";

describe("runtime role inspection against PostgreSQL", () => {
  const owner = new Pool({
    connectionString:
      process.env.TEST_DATABASE_URL ??
      "postgres://mentor:mentor@localhost:5433/mentor_test",
  });

  afterAll(async () => {
    await owner.end();
  });

  it("executes the catalog query and rejects the test database owner", async () => {
    // A mocked query cannot detect reserved-word aliases or other PostgreSQL syntax errors.
    const privileges = await owner.query<{
      owner: boolean;
      superuser: boolean;
    }>(`
      SELECT d.datdba = r.oid AS owner, r.rolsuper AS superuser
      FROM pg_database d JOIN pg_roles r ON r.rolname = current_user
      WHERE d.datname = current_database()
    `);
    expect(privileges.rows[0].owner || privileges.rows[0].superuser).toBe(true);
    await expect(
      assertRuntimeDatabaseRole(owner, "production"),
    ).rejects.toThrow("Unsafe runtime database role:");
  });
});
