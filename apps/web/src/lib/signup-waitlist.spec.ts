import { describe, expect, it } from "vitest";
import type { AppAvailabilityDto } from "@mentor/types";
import { isInviteLink, isWaitlistEmail, isWaitlistOn, opensWaitlist } from "./signup-waitlist";

const availability = (signupWaitlist: boolean) => ({ signupWaitlist }) as AppAvailabilityDto;

describe("isWaitlistOn", () => {
  it("null availability counts as waitlist", () => {
    expect(isWaitlistOn(null)).toBe(true);
  });

  it("signupWaitlist false → false", () => {
    expect(isWaitlistOn(availability(false))).toBe(false);
  });

  it("signupWaitlist true → true", () => {
    expect(isWaitlistOn(availability(true))).toBe(true);
  });
});

describe("isInviteLink", () => {
  it("davet=1 is an invite link, davet=0 is not", () => {
    expect(isInviteLink(new URLSearchParams("davet=1"))).toBe(true);
    expect(isInviteLink(new URLSearchParams("davet=1&rol=koc"))).toBe(true);
    expect(isInviteLink(new URLSearchParams("davet=0"))).toBe(false);
    expect(isInviteLink(new URLSearchParams(""))).toBe(false);
  });
});

describe("opensWaitlist", () => {
  it.each(["AUTH_GOOGLE_ACCOUNT_NOT_FOUND", "AUTH_SIGNUP_CLOSED", "AUTH_PILOT_INVITATION_REQUIRED"])(
    "%s opens the waitlist",
    (code) => {
      expect(opensWaitlist(code)).toBe(true);
    },
  );

  it("AUTH_GOOGLE_EMAIL_UNVERIFIED does not", () => {
    expect(opensWaitlist("AUTH_GOOGLE_EMAIL_UNVERIFIED")).toBe(false);
    expect(opensWaitlist(null)).toBe(false);
  });
});

describe("isWaitlistEmail", () => {
  it("accepts a plain address, trimmed", () => {
    expect(isWaitlistEmail(" ayse@ornek.com ")).toBe(true);
  });

  it("rejects an address missing its domain or @", () => {
    expect(isWaitlistEmail("ayse@ornek")).toBe(false);
    expect(isWaitlistEmail("ayse.ornek.com")).toBe(false);
    expect(isWaitlistEmail("")).toBe(false);
  });
});
