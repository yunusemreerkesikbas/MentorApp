import { describe, expect, it } from "vitest";
import {
  parseStorageInitializationArgs,
  parseStorageInitializationInput,
  type StorageInitializationArgs,
} from "./storage-initialization-input";

const args: StorageInitializationArgs = {
  envFile: "private.local",
  expectedHost: "ep-fixture-pooler.eu.neon.tech",
  expectedDatabase: "neondb",
  expectedUser: "puhu_trial_runtime",
  expectedAccountId: "0".repeat(32),
  expectedPublicBucket: "puhu-prod-public",
  expectedPrivateBucket: "puhu-prod-private",
};
const env = {
  NODE_ENV: "production",
  STORAGE_ACCESS_MODE: "bounded",
  DATABASE_URL:
    "postgres://puhu_trial_runtime:fixture@ep-fixture-pooler.eu.neon.tech/neondb?sslmode=verify-full",
  R2_ACCOUNT_ID: "0".repeat(32),
  R2_PUBLIC_BUCKET: "puhu-prod-public",
  R2_PRIVATE_BUCKET: "puhu-prod-private",
  R2_JURISDICTION: "eu",
  R2_ACCESS_KEY_ID: "fixture-key",
  R2_SECRET_ACCESS_KEY: "fixture-secret",
};

describe("attended storage initialization input", () => {
  it("rejects a mismatched account even when the bucket names match", () => {
    expect(() =>
      parseStorageInitializationInput(
        { ...env, R2_ACCOUNT_ID: "a".repeat(32) },
        args,
      ),
    ).toThrow("Invalid storage initialization configuration.");
  });
  it("requires explicit destination assertions without unrelated AI/mail credentials", () => {
    expect(parseStorageInitializationInput(env, args)).toMatchObject({
      connectionString: env.DATABASE_URL,
      scope: {
        accountId: env.R2_ACCOUNT_ID,
        publicBucket: env.R2_PUBLIC_BUCKET,
        privateBucket: env.R2_PRIVATE_BUCKET,
        jurisdiction: "eu",
      },
    });
  });
  it.each([
    "host=other.example.invalid",
    "hostaddr=127.0.0.1",
    "options=role%3Dpostgres",
    "dbname=other",
  ])("rejects a connection query override: %s", (override) => {
    expect(() =>
      parseStorageInitializationInput(
        { ...env, DATABASE_URL: env.DATABASE_URL + "&" + override },
        args,
      ),
    ).toThrow();
  });
  it.each([
    {
      ...env,
      DATABASE_MIGRATION_URL: "postgres://owner:private@owner.invalid/db",
    },
    {
      ...env,
      DATABASE_URL: env.DATABASE_URL.replace("verify-full", "require"),
    },
    {
      ...env,
      DATABASE_URL: env.DATABASE_URL.replace(
        "ep-fixture-pooler.eu.neon.tech",
        "other.neon.tech",
      ),
    },
    { ...env, DATABASE_URL: env.DATABASE_URL.replace("neondb?", "other?") },
    {
      ...env,
      DATABASE_URL: env.DATABASE_URL.replace("puhu_trial_runtime:", "owner:"),
    },
    { ...env, R2_ACCOUNT_ID: "bad@foreign.example/" },
    { ...env, R2_JURISDICTION: "auto" },
    { ...env, R2_PUBLIC_BUCKET: "puhu-s1-public" },
    { ...env, STORAGE_ACCESS_MODE: "direct" },
  ])("rejects the wrong target/scope with a redacted error", (invalid) => {
    expect(() => parseStorageInitializationInput(invalid, args)).toThrow(
      "Invalid storage initialization configuration.",
    );
    try {
      parseStorageInitializationInput(invalid, args);
    } catch (error) {
      expect(String(error)).not.toContain("fixture-secret");
      expect(String(error)).not.toContain("postgres://");
    }
  });
  it("requires complete command-line assertions and rejects unknown flags", () => {
    const argv = [
      "--env-file",
      "private.local",
      "--expected-host",
      args.expectedHost,
      "--expected-database",
      args.expectedDatabase,
      "--expected-user",
      args.expectedUser,
      "--expected-account-id",
      args.expectedAccountId,
      "--expected-public-bucket",
      args.expectedPublicBucket,
      "--expected-private-bucket",
      args.expectedPrivateBucket,
    ];
    expect(parseStorageInitializationArgs(argv)).toEqual(args);
    expect(() => parseStorageInitializationArgs([])).toThrow();
    expect(() =>
      parseStorageInitializationArgs([...argv, "--unknown", "private"]),
    ).toThrow();
    expect(() =>
      parseStorageInitializationArgs([
        ...argv,
        "--expected-host",
        "other.neon.tech",
      ]),
    ).toThrow();
  });
});
