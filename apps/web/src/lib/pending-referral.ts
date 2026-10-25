import { inviteCodeSchema } from "@mentor/validation";

/**
 * A friend's invite code survives signup and onboarding here, to be redeemed when onboarding ends.
 *
 * Same idea as `pending-invite.ts` (a study-room link), kept apart because it holds a different
 * thing: not a path to open, only the code itself. Session storage clears itself with the tab, so
 * the code is worth one sitting and never lingers for a different person on a shared device.
 *
 * The value is checked on the way in and again on the way out: storage is user-writable, and what
 * comes back ends up in a request body.
 */
const KEY = "mentor.pendingReferral";

/** Canonical code, or null when the input is not an invite code at all. */
function canonicalCode(raw: string | null): string | null {
  if (raw === null) return null;
  const parsed = inviteCodeSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function rememberPendingReferral(code: string): void {
  const canonical = canonicalCode(code);
  if (!canonical) return;
  try {
    window.sessionStorage.setItem(KEY, canonical);
  } catch {
    // Storage unavailable (private mode, quota). The code is simply not remembered; the landing
    // page shows it as text, so it can still be typed into Ayarlar.
  }
}

/** Reads and clears the pending code: it is redeemed once or not at all. */
export function consumePendingReferral(): string | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return canonicalCode(raw);
  } catch {
    return null;
  }
}
