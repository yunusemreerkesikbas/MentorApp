export type AdvertisingConsent = "accepted" | "rejected" | null;
export const ADVERTISING_CONSENT_KEY = "mentor.advertising-consent.v1"; // gitleaks:allow -- public storage key
let blockedForDocument = false;

/** A failed persistent withdrawal must still stop queued/new Google work in this document. */
export function blockAdvertisingForDocument(blocked: boolean): void { blockedForDocument = blocked; }

/** Analytics consent is deliberately never read or migrated here. */
export function readAdvertisingConsent(): AdvertisingConsent {
  if (typeof window === "undefined" || blockedForDocument) return null;
  try {
    const saved = window.localStorage.getItem(ADVERTISING_CONSENT_KEY);
    return saved === "accepted" || saved === "rejected" ? saved : null;
  } catch {
    return null;
  }
}
