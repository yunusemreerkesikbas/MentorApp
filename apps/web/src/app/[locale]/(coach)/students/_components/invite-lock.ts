import type { MentorshipCoachRegistrationStateDto } from "@mentor/types";

/**
 * Why the coach's invite code is withheld, or null when it is not (APP-089).
 *
 * The overview endpoint nulls the code without saying why, because the reason lives in the
 * registration state and duplicating it onto the overview would be two sources for one fact.
 * The card needs the difference anyway: EMAIL is something the coach fixes in one click, STANDING
 * is somebody else's decision and there is nothing for them to press.
 */
export type InviteLock = "EMAIL" | "STANDING" | null;

export function inviteLockOf(state: MentorshipCoachRegistrationStateDto): InviteLock {
  // Email first: it is the condition the coach can act on, so when both are true it is the one
  // worth reporting. The API orders its refusals the same way.
  if (!state.emailVerified) return "EMAIL";
  if (state.registration === null || state.registration.status !== "ACTIVE") return "STANDING";
  return null;
}
