import { expect, it } from "vitest";
import type { MentorshipCoachRegistrationStateDto } from "@mentor/types";
import { inviteLockOf } from "./invite-lock";

it("offers email first, then phone verification before invite creation", () => {
  const state: MentorshipCoachRegistrationStateDto = {
    registrationOpen: true, registration: null, emailVerified: false, phoneVerified: false,
  };
  expect(inviteLockOf(state)).toBe("EMAIL");
  expect(inviteLockOf({ ...state, emailVerified: true })).toBe("PHONE");
  expect(inviteLockOf({ ...state, emailVerified: true, phoneVerified: true })).toBe("STANDING");
});
