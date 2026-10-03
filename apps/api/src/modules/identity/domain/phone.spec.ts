import { describe, expect, it } from "vitest";
import { generatePhoneCode, hashPhoneCode, maskPhone, phoneAccountKey, phoneCodeMatches, phoneFingerprint } from "./phone";
import { safeLogRecord } from "../../../observability/log-record";
import { scrubSentryEvent } from "../../../observability/sentry-scrubber";

describe("phone secret boundaries", () => {
  const secret = "independent-otp-secret-with-32-characters";
  const binding = { id: "challenge", userId: "user", sessionId: "session", phoneNumber: "+905321234567", purpose: "BIND" };
  it("binds codes to the challenge, account, session, number and action", () => {
    const hash = hashPhoneCode(secret, binding, "012345");
    expect(phoneCodeMatches(hash, hashPhoneCode(secret, binding, "012345"))).toBe(true);
    for (const key of Object.keys(binding) as (keyof typeof binding)[]) {
      expect(phoneCodeMatches(hash, hashPhoneCode(secret, { ...binding, [key]: "changed" }, "012345"))).toBe(false);
    }
    expect(phoneCodeMatches(hash, hashPhoneCode("different-secret", binding, "012345"))).toBe(false);
    expect(phoneCodeMatches(hash, hashPhoneCode(secret, binding, "654321"))).toBe(false);
    expect(phoneCodeMatches("not-hex", hash)).toBe(false);
    expect(hash).not.toContain("012345");
  });
  it("produces six-digit codes including leading zeros and domain-separated fingerprints", () => {
    for (let n = 0; n < 100; n++) expect(generatePhoneCode()).toMatch(/^\d{6}$/);
    expect(phoneFingerprint(secret, binding.phoneNumber)).toHaveLength(64);
    expect(phoneFingerprint(secret, binding.phoneNumber)).not.toBe(phoneAccountKey(secret, binding.phoneNumber));
    expect(maskPhone(binding.phoneNumber)).toBe("+90 5** *** ** 67");
  });
  it("keeps phone, OTP, provider secrets and bodies out of logs and Sentry", () => {
    const record = { phoneNumber: binding.phoneNumber, code: "012345", password: "netgsm-secret", body: "012345", msg: binding.phoneNumber };
    expect(JSON.stringify(safeLogRecord(record))).toBe("{}");
    const output = JSON.stringify(scrubSentryEvent({ message: "012345", extra: record,
      request: { data: record }, user: { username: binding.phoneNumber }, breadcrumbs: [{ data: record }] }));
    for (const value of [binding.phoneNumber, "012345", "netgsm-secret"]) expect(output).not.toContain(value);
  });
});
