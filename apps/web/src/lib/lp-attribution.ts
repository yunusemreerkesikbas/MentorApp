import {
  type SeoLpSlug,
  type WaitlistCtaLocation,
  trackProductEvent,
} from "./analytics";

export const SEO_LP_SOURCE_KEY = "mentor.seo-lp-source.v1";
export const WAITLIST_CONVERSION_GUARD_KEY = "mentor.waitlist-converted.v1";

const VALID_SOURCES = new Set<SeoLpSlug>([
  "pomodoro",
  "yks",
  "tyt",
  "lgs",
  "notebook",
  "study_app",
]);

export function recordSeoLpSource(source: SeoLpSlug): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SEO_LP_SOURCE_KEY, source);
  } catch {
    // sessionStorage unavailable — ignore
  }
}

export function readSeoLpSource(): SeoLpSlug | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(SEO_LP_SOURCE_KEY);
    if (raw && VALID_SOURCES.has(raw as SeoLpSlug)) {
      return raw as SeoLpSlug;
    }
  } catch {
    // sessionStorage unavailable — ignore
  }
  return undefined;
}

/**
 * Non-reversible 32-bit FNV-1a fingerprint so duplicate submissions in the same browser session
 * do not double-fire `waitlist_signup` while never persisting raw email addresses in web storage.
 */
function fingerprintWaitlistEntry(
  email: string,
  intent: "student" | "coach",
): string {
  const normalized = `${intent}:${email.trim().toLowerCase()}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Claims a waitlist conversion once per normalized address + intent in the current session.
 * Returns `true` only on the first server-confirmed join; returns `false` on duplicate retries.
 */
export function claimWaitlistSignupConversion(
  email: string,
  intent: "student" | "coach",
): boolean {
  const token = fingerprintWaitlistEntry(email, intent);
  if (typeof window === "undefined") return true;
  try {
    const raw = window.sessionStorage.getItem(WAITLIST_CONVERSION_GUARD_KEY);
    const seen = new Set(
      (raw ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    );
    if (seen.has(token)) {
      return false;
    }
    seen.add(token);
    window.sessionStorage.setItem(
      WAITLIST_CONVERSION_GUARD_KEY,
      [...seen].slice(-20).join(","),
    );
    return true;
  } catch {
    return true;
  }
}

export function trackSeoLpSignupClick(
  source: SeoLpSlug,
  location: WaitlistCtaLocation,
  intent: "student" | "coach" = "student",
): void {
  recordSeoLpSource(source);
  trackProductEvent("waitlist_cta_click", {
    intent,
    lp_source: source,
    location,
  });
}
