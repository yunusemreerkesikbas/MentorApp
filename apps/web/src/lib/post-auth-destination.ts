import type { AuthUser } from "@mentor/types";

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
  // Control characters (newline, tab, NUL, DEL) can slip past a later parse or
  // smuggle a second header, so a path carrying any of them is rejected outright.
  const hasControlChar = [...value].some((ch) => {
    const code = ch.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });
  if (hasControlChar) return null;
  return value;
}

/**
 * Post-login/signup route — no extra DB flag; required profile fields are the gate.
 *
 * `next` (an invite link the user followed before signing up) wins only once onboarding is
 * complete: dropping someone straight into a study room before they have a username and an
 * exam would seat them at a table the app can't yet describe them at.
 */
export function postAuthDestination(
  user: AuthUser,
  next?: string | null,
): string {
  if (!hasCompletedOnboarding(user)) return "/onboarding";
  return safeNextPath(next) ?? "/dashboard";
}

/** Invite `?next=` is only needed at submit — reading it here avoids useSearchParams suspense. */
export function readAuthNextParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("next");
}

export function hasCompletedOnboarding(user: AuthUser): boolean {
  return Boolean(user.username && user.examType);
}
