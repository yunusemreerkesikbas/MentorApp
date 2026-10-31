import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.validation";

const production = {
  NODE_ENV: "production", DATABASE_URL: "postgres://fixture:fixture@localhost/fixture",
  JWT_ACCESS_SECRET: "a".repeat(32), AUTH_RATE_LIMIT_SECRET: "r".repeat(32),
  APP_URL: "https://app.mentor.test", ADMIN_APP_URL: "https://admin.mentor.test",
  EDGE_ORIGIN_SECRET: "e".repeat(32), ADMIN_ACCESS_MODE: "disabled",
  CORS_ORIGINS: "https://app.mentor.test,https://admin.mentor.test",
  TURNSTILE_SECRET_KEY: "fixture", TURNSTILE_EXPECTED_HOSTNAME: "app.mentor.test",
  PAYMENTS_PROVIDER: "disabled", AI_PROVIDER: "openai", OPENAI_API_KEY: "fixture", VISION_PROVIDER: "openai",
  STORAGE_PROVIDER: "r2", R2_ACCOUNT_ID: "account", R2_ACCESS_KEY_ID: "access", R2_SECRET_ACCESS_KEY: "secret",
  R2_PUBLIC_BUCKET: "public", R2_PRIVATE_BUCKET: "private", R2_PUBLIC_BASE_URL: "https://media.mentor.test",
  CRON_SECRET: "c".repeat(32), RESEND_API_KEY: "fixture", RESEND_FROM: "noreply@puhukoc.com",
};
const closed = { ...production, AI_PROVIDER: "disabled", VISION_PROVIDER: "disabled", OPENAI_API_KEY: undefined };

describe("credential-free disabled AI environment", () => {
  it("accepts paired disabled AI in production without either provider credential", () => {
    const env = validateEnv(closed);
    expect(env.AI_PROVIDER).toBe("disabled");
    expect(env.VISION_PROVIDER).toBe("disabled");
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.GEMINI_API_KEY).toBeUndefined();
  });

  it.each([
    ["disabled", "openai"], ["disabled", "gemini"], ["disabled", "fake"],
    ["openai", "disabled"], ["gemini", "disabled"], ["fake", "disabled"],
  ])("requires a complete disabled provider pair: %s / %s", (ai, vision) => {
    expect(() => validateEnv({ ...production, AI_PROVIDER: ai, VISION_PROVIDER: vision,
      GEMINI_API_KEY: "fixture" })).toThrow(/disabled together/);
  });

  it.each(["AI_PROVIDER", "VISION_PROVIDER"])("rejects an unknown %s value", (key) => {
    expect(() => validateEnv({ ...production, [key]: "off" })).toThrow(new RegExp(key));
  });

  it.each([
    ["AI_PROVIDER", "openai", "OPENAI_API_KEY"], ["AI_PROVIDER", "gemini", "GEMINI_API_KEY"],
    ["VISION_PROVIDER", "openai", "OPENAI_API_KEY"], ["VISION_PROVIDER", "gemini", "GEMINI_API_KEY"],
  ])("still requires the real credential for %s=%s", (provider, value, key) => {
    expect(() => validateEnv({ ...production, GEMINI_API_KEY: "fixture",
      [provider]: value, [key]: undefined })).toThrow(new RegExp(key));
  });

  it.each(["EDGE_ORIGIN_SECRET", "AUTH_RATE_LIMIT_SECRET", "TURNSTILE_SECRET_KEY",
    "RESEND_API_KEY", "R2_SECRET_ACCESS_KEY", "CRON_SECRET"])("retains the %s production lock", (key) => {
    expect(() => validateEnv({ ...closed, [key]: undefined })).toThrow(/Invalid environment variables/);
  });

  it("retains Access validation when admin access is selected", () => {
    expect(() => validateEnv({ ...closed, ADMIN_ACCESS_MODE: "cloudflare" })).toThrow(/CLOUDFLARE_ACCESS/);
  });
});
