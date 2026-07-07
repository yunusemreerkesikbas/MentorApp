import type { AuthUser } from "@mentor/types";

/** Post-login/signup route — no extra DB flag; required profile fields are the gate. */
export function postAuthDestination(
  user: AuthUser,
): "/onboarding" | "/panel" {
  return hasCompletedOnboarding(user) ? "/panel" : "/onboarding";
}

export function hasCompletedOnboarding(user: AuthUser): boolean {
  return Boolean(user.username && user.examType);
}
