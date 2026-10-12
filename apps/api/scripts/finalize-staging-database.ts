import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { Client } from "pg";
import { assertRuntimeDatabaseRole } from "../src/database/database-role-safety";

/** Apply the approved AI-off/console-email bootstrap only to the recorded staging database. */
let phase = "validate-target";
let roleInspectionCode: string | undefined;
async function main(): Promise<void> {
  const env = parse(readFileSync(resolve(__dirname, "../../../.env.staging")));
  const ownerUrl = new URL(env.DATABASE_MIGRATION_URL);
  const runtimeUrl = new URL(env.DATABASE_URL);
  if (
    env.APP_ENV !== "staging" ||
    ownerUrl.hostname !==
      "ep-gentle-sky-b9gnp8lq.c-7.eu-central-1.aws.neon.tech" ||
    runtimeUrl.hostname !==
      "ep-gentle-sky-b9gnp8lq-pooler.c-7.eu-central-1.aws.neon.tech" ||
    ownerUrl.pathname !== "/mentor" ||
    runtimeUrl.pathname !== "/mentor" ||
    ownerUrl.username !== "puhu_s1_migration" ||
    runtimeUrl.username !== "puhu_s1_runtime"
  ) {
    throw new Error(
      "This bootstrap is restricted to the recorded puhu-s1 database.",
    );
  }
  const owner = new Client({
    connectionString: ownerUrl.toString(),
    connectionTimeoutMillis: 15_000,
  });
  const runtime = new Client({
    connectionString: runtimeUrl.toString(),
    connectionTimeoutMillis: 15_000,
  });
  try {
    phase = "owner-connect";
    await owner.connect();
    phase = "bootstrap-flags";
    await owner.query("BEGIN");
    try {
      await owner.query("SET LOCAL app.role = 'SERVICE'");
      for (const [key, value] of [
        ["ai.enabled", false],
        ["dev.email.console_enabled", true],
      ] as const) {
        await owner.query(
          "INSERT INTO config_overrides (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
          [key, JSON.stringify(value)],
        );
      }
      await owner.query("COMMIT");
    } catch (error) {
      await owner.query("ROLLBACK");
      throw error;
    }
    phase = "runtime-connect";
    await runtime.connect();
    phase = "runtime-role-safety";
    await assertRuntimeDatabaseRole(
      {
        query: async (sql) => {
          try {
            return await runtime.query(sql);
          } catch (error) {
            if (
              typeof error === "object" &&
              error !== null &&
              "code" in error
            ) {
              roleInspectionCode = String(error.code);
            }
            throw error;
          }
        },
      },
      "production",
    );
    phase = "read-evidence";
    const migrationCount = await owner.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations",
    );
    const safetyFlags = await owner.query<{ key: string; value: unknown }>(
      "SELECT key, value FROM config_overrides WHERE key IN ('ai.enabled', 'dev.email.console_enabled') ORDER BY key",
    );
    console.log(
      JSON.stringify({
        stageDatabaseReady: true,
        runtimeRoleSafe: true,
        appliedMigrations: migrationCount.rows[0].count,
        safetyFlags: safetyFlags.rows,
      }),
    );
  } finally {
    await runtime.end();
    await owner.end();
  }
}

void main().catch((error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : "STAGING_SETUP_ERROR";
  const reason =
    error instanceof Error &&
    error.message.startsWith("Unsafe runtime database role:")
      ? "unsafe-runtime-role"
      : error instanceof Error &&
          error.message === "Runtime database role safety check failed."
        ? "role-inspection-failed"
        : undefined;
  console.error("Stage database finalization failed", {
    phase,
    code,
    reason,
    roleInspectionCode,
  });
  process.exitCode = 1;
});
