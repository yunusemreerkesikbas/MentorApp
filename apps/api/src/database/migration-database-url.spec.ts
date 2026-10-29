import { afterEach, describe, expect, it, vi } from "vitest";
import { getMigrationDatabaseUrl } from "./migration-database-url";

// Prevent config imports from reading a developer's private .env file.
vi.mock("dotenv/config", () => ({}));

const DIRECT = "postgresql://migration_owner:fixture-password@ep-test.eu-central-1.aws.neon.tech/mentor?sslmode=require";
const RUNTIME = "postgresql://runtime:runtime-password@ep-test-pooler.eu-central-1.aws.neon.tech/mentor?sslmode=require";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("migration database URL", () => {
  it("selects the explicit migration credential instead of the runtime credential", () => {
    expect(getMigrationDatabaseUrl({ NODE_ENV: "production", DATABASE_URL: RUNTIME, DATABASE_MIGRATION_URL: DIRECT }))
      .toBe(DIRECT);
  });

  it.each([undefined, "", " "])("rejects absent production migration credentials (%j) without falling back", (url) => {
    expect(() => getMigrationDatabaseUrl({ NODE_ENV: "production", DATABASE_URL: RUNTIME, DATABASE_MIGRATION_URL: url }))
      .toThrow(/DATABASE_MIGRATION_URL/);
  });

  it.each([
    RUNTIME,
    "postgresql://owner:fixture-password@EP-TEST-POOLER.eu-central-1.aws.NEON.TECH/mentor",
    "postgresql://owner:fixture-password@ep-test-pooler.eu-central-1.aws.neon.tech./mentor",
    "postgresql://owner:fixture-password@ep-test-poo%6cer.eu-central-1.aws.neon.tech/mentor",
  ])("rejects a Neon pooler URL for migrations (%s)", (url) => {
    expect(() => getMigrationDatabaseUrl({ NODE_ENV: "production", DATABASE_MIGRATION_URL: url }))
      .toThrow(/direct.*connection/i);
  });

  it.each([
    "not-a-url-fixture-password",
    "https://owner:fixture-password@database.test/mentor",
    "postgresql://owner:fixture-password@ep-test-poo%invalid.neon.tech/mentor",
  ])(
    "rejects invalid connections without echoing a password", (url) => {
      let message = "";
      try { getMigrationDatabaseUrl({ NODE_ENV: "production", DATABASE_MIGRATION_URL: url }); }
      catch (error) { message = (error as Error).message; }
      expect(message).toMatch(/PostgreSQL/);
      expect(message).not.toContain("fixture-password");
      expect(message).not.toContain(url);
    },
  );

  it.each(["host", "hostaddr"])("rejects a query-string %s override instead of validating a different server", (key) => {
    expect(() => getMigrationDatabaseUrl({
      NODE_ENV: "production",
      DATABASE_MIGRATION_URL: `${DIRECT}&${key}=ep-other-pooler.eu-central-1.aws.neon.tech`,
    })).toThrow(/host override/i);
  });

  it.each(["development", "test", undefined])("keeps the local DATABASE_URL fallback in %s", (nodeEnv) => {
    expect(getMigrationDatabaseUrl({ NODE_ENV: nodeEnv, DATABASE_URL: "postgres://mentor:mentor@localhost:5433/mentor_test" }))
      .toBe("postgres://mentor:mentor@localhost:5433/mentor_test");
  });

  it("rejects missing local configuration before opening a connection", () => {
    expect(() => getMigrationDatabaseUrl({ NODE_ENV: "test" })).toThrow(/DATABASE_URL/);
  });

  it("enforces the production boundary through the real dedicated Drizzle config", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", RUNTIME);
    vi.stubEnv("DATABASE_MIGRATION_URL", undefined);
    await expect(import("../../drizzle.migrate.config")).rejects.toThrow(/DATABASE_MIGRATION_URL/);
  });

  it("passes the explicit owner connection into the real migration config", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", RUNTIME);
    vi.stubEnv("DATABASE_MIGRATION_URL", DIRECT);
    const { default: config } = await import("../../drizzle.migrate.config");
    expect(config.dbCredentials).toEqual({ url: DIRECT });
    expect(config.out).toBe("./drizzle");
  });

  it("leaves offline schema generation usable without database credentials", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("DATABASE_MIGRATION_URL", undefined);
    const { default: config } = await import("../../drizzle.config");
    expect(config.schema).toBe("./src/database/schema-all.ts");
  });
});
