import { expect, it } from "vitest";
import type { MentorshipCoachRegistrationStateDto } from "@mentor/types";
import { inviteLockOf } from "./invite-lock";

it("renders the backend invitation decision instead of inferring a phone requirement", () => {
  const state: MentorshipCoachRegistrationStateDto = {
    registrationOpen: true, registration: null, emailVerified: false, phoneVerified: false,
    hasCoach: false, inviteBlockedReason: null,
  };
  expect(inviteLockOf(state)).toBeNull();
  expect(inviteLockOf({ ...state, inviteBlockedReason: "EMAIL_UNVERIFIED" })).toBe("EMAIL");
  expect(inviteLockOf({ ...state, inviteBlockedReason: "PHONE_UNVERIFIED" })).toBe("PHONE");
  expect(inviteLockOf({ ...state, inviteBlockedReason: "NOT_ACTIVE" })).toBe("STANDING");
});
