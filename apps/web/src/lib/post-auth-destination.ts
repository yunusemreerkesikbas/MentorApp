import { routing, type Locale } from "@/i18n/routing";

export {
  hasCompletedOnboarding,
  postAuthDestination,
  safeNextPath,
} from "@mentor/core";

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
  const locale =
    prefixed && prefixed[1] !== routing.defaultLocale
      ? prefixed[1]
      : routing.defaultLocale;
  const bare =
    prefixed && prefixed[1] !== routing.defaultLocale
      ? path.slice(3) || "/"
      : path;
  for (const [internal, localized] of Object.entries(routing.pathnames)) {
    const visible =
      typeof localized === "string" ? localized : localized[locale as Locale];
    const params: string[] = [];
    const pattern = visible.replace(/\[([^\]]+)\]/g, (_, name: string) => {
      params.push(name);
      return "([^/]+)";
    });
    const match = new RegExp(`^${pattern}$`).exec(bare);
    if (!match) continue;
    let resolved = internal;
    params.forEach(
      (name, i) => (resolved = resolved.replace(`[${name}]`, match[i + 1]!)),
    );
    return resolved + rest;
  }
  return bare + rest;
}
