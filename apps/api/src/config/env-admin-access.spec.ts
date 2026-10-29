import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.validation";

const production = {
  NODE_ENV: "production", DATABASE_URL: "postgres://runtime:fixture@localhost/trial",
  JWT_ACCESS_SECRET: "j".repeat(32), AUTH_RATE_LIMIT_SECRET: "r".repeat(32),
  EDGE_ORIGIN_SECRET: "e".repeat(32), APP_URL: "https://puhu.test",
  ADMIN_APP_URL: "https://admin.puhu.test", CORS_ORIGINS: "https://puhu.test,https://admin.puhu.test",
  TURNSTILE_SECRET_KEY: "fixture", TURNSTILE_EXPECTED_HOSTNAME: "puhu.test",
  PAYMENTS_PROVIDER: "disabled", AI_PROVIDER: "openai", VISION_PROVIDER: "openai",
  OPENAI_API_KEY: "fixture", STORAGE_PROVIDER: "r2", R2_ACCOUNT_ID: "fixture",
  R2_ACCESS_KEY_ID: "fixture", R2_SECRET_ACCESS_KEY: "fixture", R2_PUBLIC_BUCKET: "public",
  R2_PRIVATE_BUCKET: "private", R2_PUBLIC_BASE_URL: "https://media.puhu.test",
  CRON_SECRET: "c".repeat(32), RESEND_API_KEY: "fixture", RESEND_FROM: "noreply@puhu.test",
};
const access = {
  CLOUDFLARE_ACCESS_TEAM_DOMAIN: "https://puhu.cloudflareaccess.com",
  CLOUDFLARE_ACCESS_AUD: "fixture-audience",
};

describe("admin deployment mode", () => {
  it("defaults to requiring real Access configuration", () => {
    expect(() => validateEnv(production)).toThrow(/CLOUDFLARE_ACCESS/);
    expect(validateEnv({ ...production, ...access })).toMatchObject({ ADMIN_ACCESS_MODE: "cloudflare" });
  });

  it("accepts an explicitly closed admin without Access enrollment", () => {
    expect(() => validateEnv({ ...production, ADMIN_ACCESS_MODE: "disabled" })).not.toThrow();
  });

  it.each(["", "false", "bypass", "DISABLED"])("rejects an invalid mode %j", (mode) => {
    expect(() => validateEnv({ ...production, ...access, ADMIN_ACCESS_MODE: mode }))
      .toThrow(/ADMIN_ACCESS_MODE/);
  });

  it.each(["CLOUDFLARE_ACCESS_TEAM_DOMAIN", "CLOUDFLARE_ACCESS_AUD"])(
    "still requires %s in explicit cloudflare mode", (key) => {
      expect(() => validateEnv({ ...production, ...access, ADMIN_ACCESS_MODE: "cloudflare", [key]: undefined }))
        .toThrow(new RegExp(key));
    },
  );

  it.each([
    "EDGE_ORIGIN_SECRET", "TURNSTILE_SECRET_KEY", "TURNSTILE_EXPECTED_HOSTNAME",
    "RESEND_API_KEY", "RESEND_FROM", "OPENAI_API_KEY", "R2_SECRET_ACCESS_KEY", "CRON_SECRET",
  ])("retains the production %s requirement with admin closed", (key) => {
    expect(() => validateEnv({ ...production, ADMIN_ACCESS_MODE: "disabled", [key]: undefined }))
      .toThrow(new RegExp(key === "R2_SECRET_ACCESS_KEY" ? "R2_PUBLIC_BUCKET" : key));
  });

  it.each(["APP_URL", "ADMIN_APP_URL", "CORS_ORIGINS"])("rejects insecure %s with admin closed", (key) => {
    expect(() => validateEnv({ ...production, ADMIN_ACCESS_MODE: "disabled", [key]: "http://localhost" }))
      .toThrow(new RegExp(key));
  });
});
