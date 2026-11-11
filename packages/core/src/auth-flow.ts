import type { AppAvailabilityDto, AuthUser } from "@mentor/types";
import { COACH_HOME, isCoach } from "./coach-surface.js";
import { availableAppDestination } from "./feature-routes.js";

/**
 * Where a `?next=` value is allowed to send someone after auth. Only same-origin absolute
 * paths: anything that could leave the site — a scheme, a protocol-relative `//host`, a
 * backslash Windows/browsers may normalise into one — is discarded rather than sanitised,
 * because a redirect target is exactly the input an attacker would like to control.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  const value = next.trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  const hasControlChar = [...value].some((ch) => {
    const code = ch.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });
  if (hasControlChar) return null;
  return value;
}

export function hasCompletedOnboarding(
  user: Pick<AuthUser, "username" | "examType">,
): boolean {
  return Boolean(user.username && user.examType);
}

/**
 * Post-login/signup route — no extra DB flag; required profile fields are the gate.
 */
export function postAuthDestination(
  user: AuthUser,
  next: string | null | undefined,
  availability: AppAvailabilityDto | null,
): string {
  if (!hasCompletedOnboarding(user)) return "/onboarding";
  const safeNext = availableAppDestination(safeNextPath(next), user, availability);
  if (isCoach(user)) {
    return safeNext && /^\/(?:[a-z]{2}\/)?(?:plan|settings|profile)(?:[/?#]|$)/.test(safeNext)
      ? safeNext
      : availability?.humanCoaching
        ? COACH_HOME
        : "/settings";
  }
  return safeNext ?? "/dashboard";
}

/**
 * Invite-only signup. When the waitlist is on, "start" actions open the waitlist modal instead of
 * the signup form. A missing availability snapshot counts as on (fail closed): the API decides who
 * may register, so clients never advertise an open door they cannot vouch for.
 */
export function isWaitlistOn(availability: AppAvailabilityDto | null): boolean {
  return availability?.signupWaitlist ?? true;
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
