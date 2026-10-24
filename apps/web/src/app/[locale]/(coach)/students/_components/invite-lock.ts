import type { MentorshipCoachRegistrationStateDto } from "@mentor/types";

/**
 * Why the coach's invite code is withheld, or null when it is not (APP-089).
 *
 * The overview endpoint nulls the code without saying why, because the reason lives in the
 * registration state and duplicating it onto the overview would be two sources for one fact.
 * EMAIL resends the verification mail; PHONE opens the private SMS form in settings.
 * STANDING is somebody else's decision and there is nothing for them to press.
 */
export type InviteLock = "EMAIL" | "PHONE" | "STANDING" | null;

export function inviteLockOf(state: MentorshipCoachRegistrationStateDto): InviteLock {
  const reason = state.inviteBlockedReason;
  if (reason === null) return null;
  const labels = { EMAIL_UNVERIFIED: "EMAIL", PHONE_UNVERIFIED: "PHONE", NOT_ACTIVE: "STANDING" } as const;
  return labels[reason];
}
