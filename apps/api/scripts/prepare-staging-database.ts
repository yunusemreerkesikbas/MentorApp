import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { Client } from "pg";

/** One-time bootstrap for the isolated puhu-s1 database; never loads the local development .env. */
async function main(): Promise<void> {
  const env = parse(readFileSync(resolve(__dirname, "../../../.env.staging")));
  if (env.APP_ENV !== "staging") {
    throw new Error("Explicit staging credentials are required.");
  }
  const ownerUrl = new URL(env.DATABASE_MIGRATION_URL);
  const runtimeUrl = new URL(env.DATABASE_URL);
  if (
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
  try {
    await owner.connect();
    await owner.query("CREATE EXTENSION IF NOT EXISTS vector");
    const exists = await owner.query(
      "SELECT 1 FROM pg_roles WHERE rolname = $1",
      ["puhu_s1_runtime"],
    );
    if (exists.rowCount)
      throw new Error("Role exists; refusing credential replacement.");
    const password = decodeURIComponent(runtimeUrl.password);
    if (!/^[A-Za-z0-9_-]{32,}$/.test(password))
      throw new Error("Unexpected generated password format.");
    await owner.query(
      "CREATE ROLE puhu_s1_runtime WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '" +
        password +
        "'",
    );
    await owner.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
    await owner.query("GRANT CONNECT ON DATABASE mentor TO puhu_s1_runtime");
    await owner.query("GRANT USAGE ON SCHEMA public TO puhu_s1_runtime");
    await owner.query(
      "ALTER DEFAULT PRIVILEGES FOR ROLE puhu_s1_migration IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO puhu_s1_runtime",
    );
    await owner.query(
      "ALTER DEFAULT PRIVILEGES FOR ROLE puhu_s1_migration IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO puhu_s1_runtime",
    );
    console.log("Stage pgvector and restricted runtime role prepared.");
  } finally {
    await owner.end();
  }
}

void main().catch((error: unknown) => {
  // Provider error text can contain connection details; only a stable diagnostic code is emitted.
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : "STAGING_SETUP_ERROR";
  console.error("Stage database preparation failed", { code });
  process.exitCode = 1;
});
