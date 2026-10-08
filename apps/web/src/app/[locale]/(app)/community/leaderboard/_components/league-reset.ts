import type { LeaderboardWindow } from "@mentor/types";

const IST_OFFSET_MS = 3 * 60 * 60 * 1000; // Europe/Istanbul (UTC+3, no DST), the backend's boundaries.

/** When the league for a window starts over (next Istanbul midnight / Monday); all-time never does. */
export function nextLeagueReset(window: LeaderboardWindow, now: Date): Date | null {
  if (window === "all_time") return null;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  let dayMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  if (window === "today") {
    dayMs += 86_400_000;
  } else {
    dayMs -= ((new Date(dayMs).getUTCDay() + 6) % 7) * 86_400_000; // this Monday
    dayMs += 7 * 86_400_000; // next Monday
  }
  return new Date(dayMs - IST_OFFSET_MS);
}
