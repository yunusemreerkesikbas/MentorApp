import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.validation";

const REQUIRED = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  JWT_ACCESS_SECRET: "a".repeat(32),
  AUTH_RATE_LIMIT_SECRET: "r".repeat(32),
  PAYMENTS_WEBHOOK_SECRET: "b".repeat(16),
};
const NETGSM = {
  ...REQUIRED, SMS_PROVIDER: "netgsm", NETGSM_USERCODE: "8501234567",
  NETGSM_API_PASSWORD: "api-subuser-test-password", NETGSM_MSGHEADER: "Mentor",
  PHONE_OTP_SECRET: "o".repeat(32), PHONE_FINGERPRINT_SECRET: "f".repeat(32),
};

describe("Netgsm OTP environment contract", () => {
  it.each(["A", "AB", " AB "])("rejects a sender shorter than three characters: %j", (header) => {
    expect(() => validateEnv({ ...NETGSM, NETGSM_MSGHEADER: header })).toThrow(/NETGSM_MSGHEADER/);
  });

  it.each(["ABC", "ABCDEFGHIJK"])("accepts a sender at the documented length bounds: %s", (header) => {
    expect(validateEnv({ ...NETGSM, NETGSM_MSGHEADER: header }).NETGSM_MSGHEADER).toBe(header);
  });

  it("rejects a sender longer than eleven characters", () => {
    expect(() => validateEnv({ ...NETGSM, NETGSM_MSGHEADER: "ABCDEFGHIJKL" })).toThrow(/NETGSM_MSGHEADER/);
  });

  it("requires the API credentials and independent phone secrets only for enabled Netgsm", () => {
    expect(() => validateEnv({ ...REQUIRED, SMS_PROVIDER: "netgsm" })).toThrow(/SMS_PROVIDER/);
    expect(() => validateEnv({ ...NETGSM, PHONE_FINGERPRINT_SECRET: NETGSM.PHONE_OTP_SECRET }))
      .toThrow(/PHONE_FINGERPRINT_SECRET/);
    expect(validateEnv({ ...REQUIRED, SMS_PROVIDER: "disabled", NETGSM_MSGHEADER: "" }).SMS_PROVIDER)
      .toBe("disabled");
  });
});
