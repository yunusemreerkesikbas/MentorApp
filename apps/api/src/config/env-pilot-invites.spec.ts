import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.validation";

const required = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  JWT_ACCESS_SECRET: "a".repeat(32),
  AUTH_RATE_LIMIT_SECRET: "r".repeat(32),
  PAYMENTS_WEBHOOK_SECRET: "b".repeat(16),
};

describe("private pilot invitation configuration", () => {
  it.each([undefined, "", "   "])("defaults an absent/blank list to no invitations: %s", (list) => {
    expect(validateEnv({ ...required, PILOT_INVITED_EMAILS: list }).PILOT_INVITED_EMAILS).toEqual([]);
  });

  it("uses shared email normalization for each exact address", () => {
    expect(validateEnv({ ...required, PILOT_INVITED_EMAILS: " Student@Example.com , other+pilot@example.com" }).PILOT_INVITED_EMAILS)
      .toEqual(["student@example.com", "other+pilot@example.com"]);
  });

  it.each(["@example.com", "*@example.com", "student@example.com,", "student@example.com, STUDENT@example.com"])("rejects malformed/duplicate entries: %s", (list) => {
    expect(() => validateEnv({ ...required, PILOT_INVITED_EMAILS: list })).toThrow(/PILOT_INVITED_EMAILS/);
  });

  it("does not include an invalid private address in startup diagnostics", () => {
    const privateValue = "personal-address-with-invalid-domain@";
    const failure = (() => {
      try { validateEnv({ ...required, PILOT_INVITED_EMAILS: privateValue }); }
      catch (error) { return String(error); }
      return "";
    })();
    expect(failure).toContain("PILOT_INVITED_EMAILS");
    expect(failure).not.toContain(privateValue);
  });
});
