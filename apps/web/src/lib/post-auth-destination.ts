import type { AppAvailabilityDto, AuthUser } from "@mentor/types";
import { routing, type Locale } from "@/i18n/routing";
import { COACH_HOME, isCoach } from "./coach-surface";
import { availableAppDestination } from "./app-feature-routes";

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
 *
 * A COACH normally goes to their own surface. APP-090 ignored every `next` because every route
 * produced at the time was student-only. APP-091 adds one narrow exception for the now role-aware
 * `/plan`; study-room and student-mentorship links still fall back to the coach home.
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
      : availability?.humanCoaching ? COACH_HOME : "/settings";
  }
  return safeNext ?? "/dashboard";
}

/** Invite `?next=` is only needed at submit — reading it here avoids useSearchParams suspense. */
export function readAuthNextParam(): string | null {
  if (typeof window === "undefined") return null;
  const next = new URLSearchParams(window.location.search).get("next");
  return next === null ? null : internalPathFromUrl(next);
}

/**
 * The `(app)` guard puts the URL the user actually sees into `?next=` (`/panel`, not the internal
 * `/dashboard`), but everything after auth — the next-intl router, the coach allow-list, the Google
 * `returnTo` — speaks internal routes. This maps one back. Internal paths (other producers still
 * send `/profile` etc.) and unknown paths pass through untouched.
 */
export function internalPathFromUrl(next: string): string {
  const cut = next.search(/[?#]/);
  const path = cut === -1 ? next : next.slice(0, cut);
  const rest = cut === -1 ? "" : next.slice(cut);
  const prefixed = /^\/([a-z]{2})(?=\/|$)/.exec(path);
  const locale = prefixed && prefixed[1] !== routing.defaultLocale ? prefixed[1] : routing.defaultLocale;
  const bare = prefixed && prefixed[1] !== routing.defaultLocale ? path.slice(3) || "/" : path;
  for (const [internal, localized] of Object.entries(routing.pathnames)) {
    const visible = typeof localized === "string" ? localized : localized[locale as Locale];
    const params: string[] = [];
    const pattern = visible.replace(/\[([^\]]+)\]/g, (_, name: string) => {
      params.push(name);
      return "([^/]+)";
    });
    const match = new RegExp(`^${pattern}$`).exec(bare);
    if (!match) continue;
    let resolved = internal;
    params.forEach((name, i) => (resolved = resolved.replace(`[${name}]`, match[i + 1]!)));
    return resolved + rest;
  }
  return bare + rest;
}

export function hasCompletedOnboarding(user: AuthUser): boolean {
  return Boolean(user.username && user.examType);
}
