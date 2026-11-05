import type { AppAvailabilityDto } from "@mentor/types";

/**
 * Invite-only signup. When the waitlist is on, "start" actions open the waitlist modal instead of
 * the signup form. A missing availability snapshot counts as on (fail closed): the API decides who
 * may register, so the web never advertises an open door it cannot vouch for.
 */
export function isWaitlistOn(availability: AppAvailabilityDto | null): boolean {
  return availability?.signupWaitlist ?? true;
}

/** The invite email's link (`/kayit?davet=1`) lands on the signup form even while the waitlist is on. */
export function isInviteLink(search: URLSearchParams): boolean {
  return search.get("davet") === "1";
}

/** Signup refusals that mean "not invited yet": the answer is the waitlist, not an error line. */
const WAITLIST_CODES: ReadonlySet<string> = new Set([
  "AUTH_GOOGLE_ACCOUNT_NOT_FOUND",
  "AUTH_SIGNUP_CLOSED",
  "AUTH_PILOT_INVITATION_REQUIRED",
]);

export function opensWaitlist(code: string | null): boolean {
  return code !== null && WAITLIST_CODES.has(code);
}

/** Client-side shape check only; the API validates again. */
export function isWaitlistEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
