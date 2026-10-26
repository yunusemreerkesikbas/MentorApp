import { describe, expect, it, vi } from "vitest";
import { coachContactVerification } from "./coach-contact-verification";

describe("coach contact requirements", () => {
  const users = (email: boolean, phone: boolean) => ({
    isEmailVerified: vi.fn(async () => email),
    isPhoneVerified: vi.fn(async () => phone),
  });

  it("allows an email-verified coach without a phone when the requirement is off", async () => {
    const identity = users(true, false);
    expect(await coachContactVerification(identity as never, "coach", false)).toBeNull();
    expect(identity.isPhoneVerified).not.toHaveBeenCalled();
  });

  it("still requires a verified email when phone verification is optional", async () => {
    expect(await coachContactVerification(users(false, false) as never, "coach", false))
      .toBe("EMAIL_UNVERIFIED");
  });

  it("does not bypass an enabled phone requirement", async () => {
    expect(await coachContactVerification(users(true, false) as never, "coach", true))
      .toBe("PHONE_UNVERIFIED");
  });
});
