import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.validation";

const REQUIRED = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  JWT_ACCESS_SECRET: "a".repeat(32),
};

describe("validateEnv", () => {
  it("throws when required vars are missing (fail-fast)", () => {
    expect(() => validateEnv({})).toThrow(/Invalid environment/);
    expect(() => validateEnv({ DATABASE_URL: REQUIRED.DATABASE_URL })).toThrow(
      /Invalid environment/,
    ); // JWT secret missing
  });

  it("applies defaults when required vars are present", () => {
    const env = validateEnv({ ...REQUIRED });
    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe("development");
    expect(env.JWT_ACCESS_TTL).toBe(900);
    expect(env.JWT_REFRESH_TTL).toBe(2_592_000);
    expect(env.IYZICO_BASE_URL).toContain("sandbox");
  });

  it("rejects an invalid DATABASE_URL", () => {
    expect(() => validateEnv({ ...REQUIRED, DATABASE_URL: "not-a-url" })).toThrow();
  });
});
