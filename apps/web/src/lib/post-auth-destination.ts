import type { AuthUser } from "@mentor/types";

/** Post-login/signup route — gate is identity-owned examType only (no extra DB flag). */
export function postAuthDestination(
  user: AuthUser,
): "/onboarding" | "/panel" {
  return user.examType ? "/panel" : "/onboarding";
}
