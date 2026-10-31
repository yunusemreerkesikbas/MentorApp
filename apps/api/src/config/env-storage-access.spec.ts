import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.validation";

const base = {
  NODE_ENV: "test", APP_ENV: "development", DATABASE_URL: "postgres://mentor:mentor@localhost:5433/mentor_storage_budget_test",
  JWT_ACCESS_SECRET: "test-jwt-access-00000000000000000000",
  AUTH_RATE_LIMIT_SECRET: "test-auth-rate-000000000000000000000",
  PAYMENTS_PROVIDER: "disabled", AI_PROVIDER: "fake", VISION_PROVIDER: "fake", STORAGE_PROVIDER: "fake",
};
const bounded = { ...base, STORAGE_ACCESS_MODE: "bounded", MEDIA_READ_SECRET: "test-media-read-0000000000000000000",
  R2_ACCOUNT_ID: "fixture-account", R2_PUBLIC_BUCKET: "fixture-public", R2_PRIVATE_BUCKET: "fixture-private",
  R2_JURISDICTION: "eu", R2_PUBLIC_BASE_URL: "https://api.example.invalid/v1/storage/media/public" };

describe("storage access deployment validation", () => {
  it("preserves direct mode for existing configurations", () => {
    expect(validateEnv(base)).toMatchObject({ STORAGE_ACCESS_MODE: "direct" });
  });
  it("accepts bounded mode with its explicit private gateway settings", () => {
    expect(validateEnv(bounded)).toMatchObject({ STORAGE_ACCESS_MODE: "bounded" });
  });
  it("rejects an unrecognized storage mode", () => {
    expect(() => validateEnv({ ...bounded, STORAGE_ACCESS_MODE: "typo" })).toThrow();
  });
  it.each(["MEDIA_READ_SECRET", "R2_ACCOUNT_ID", "R2_PUBLIC_BUCKET", "R2_PRIVATE_BUCKET", "R2_PUBLIC_BASE_URL"])("requires %s for bounded mode", (name) => {
    expect(() => validateEnv({ ...bounded, [name]: "" })).toThrow();
  });
  it("requires EU jurisdiction and distinct bucket names", () => {
    expect(() => validateEnv({ ...bounded, R2_JURISDICTION: "auto" })).toThrow();
    expect(() => validateEnv({ ...bounded, R2_PRIVATE_BUCKET: bounded.R2_PUBLIC_BUCKET })).toThrow();
  });
  it.each(["bad@foreign.example/", "not-an-account"])("rejects an unsafe real R2 account identifier: %s", accountId => {
    expect(() => validateEnv({...bounded,STORAGE_PROVIDER:"r2",R2_ACCOUNT_ID:accountId,R2_ACCESS_KEY_ID:"fixture-key",R2_SECRET_ACCESS_KEY:"fixture-secret"})).toThrow();
  });
  it("does not reuse auth signing material for media grants", () => {
    expect(() => validateEnv({ ...bounded, MEDIA_READ_SECRET: base.JWT_ACCESS_SECRET })).toThrow();
  });
  it.each([
    "https://bucket.r2.dev", "https://api.example.invalid/v1/storage/media/public?secret=value",
    "https://api.example.invalid/v1/storage/media/public#fragment", "https://user:pass@api.example.invalid/v1/storage/media/public",
    "http://api.example.invalid/v1/storage/media/public",
  ])("rejects an unsafe gateway base without echoing it", (value) => {
    expect(() => validateEnv({ ...bounded, R2_PUBLIC_BASE_URL: value })).toThrow();
    try { validateEnv({ ...bounded, R2_PUBLIC_BASE_URL: value }); } catch (error) {
      expect(String(error)).not.toContain(value);
    }
  });
  it("permits an explicit loopback HTTP gateway only in development/test", () => {
    expect(() => validateEnv({ ...bounded, R2_PUBLIC_BASE_URL: "http://localhost:3001/v1/storage/media/public" })).not.toThrow();
    expect(() => validateEnv({ ...bounded, APP_ENV: "production", R2_PUBLIC_BASE_URL: "http://localhost:3001/v1/storage/media/public" })).toThrow();
  });
});
