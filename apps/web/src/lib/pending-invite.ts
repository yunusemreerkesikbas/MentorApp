import { safeNextPath } from "@/lib/post-auth-destination";

/**
 * An invite link followed before signing in survives the auth detour here.
 *
 * `?next=` alone is not enough: a brand-new user goes signup → onboarding → app, and the query
 * string does not survive that hop. Session storage does, and it clears itself when the tab
 * closes — an invite is worth remembering for one sitting, not forever.
 */
const KEY = "mentor.pendingInvite";

export function rememberPendingInvite(path: string): void {
  const safe = safeNextPath(path);
  if (!safe) return;
  try {
    window.sessionStorage.setItem(KEY, safe);
  } catch {
    // Storage unavailable (private mode, quota) — the invite is simply not remembered.
  }
}

/** Reads and clears the pending invite. Re-validated on the way out: storage is user-writable. */
export function consumePendingInvite(): string | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return safeNextPath(raw);
  } catch {
    return null;
  }
}
