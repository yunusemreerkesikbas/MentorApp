import type { LeaderboardWindow, RankMovement } from "@mentor/types";

/**
 * Leaderboard time windows. Day/week boundaries are Europe/Istanbul (UTC+03:00, no DST since 2016),
 * so "Bugün"/"Hafta" line up with the user's local day — while the DB still stores UTC instants.
 * // ponytail: fixed +3 offset; swap for a tz lib only if Türkiye ever restores DST.
 */
const IST_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Coerce an untrusted query value to a window; unknown → "weekly" (safe default). */
export function toWindow(raw: unknown): LeaderboardWindow {
  return raw === "today" || raw === "all_time" ? raw : "weekly";
}

/** The `since` instant (UTC) a window starts at. all_time → epoch (no lower bound in practice). */
export function windowStart(window: LeaderboardWindow, now = new Date()): Date {
  if (window === "all_time") return new Date(0);
  // Shift into Istanbul wall-clock, floor to the day, then shift back to the real UTC instant.
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  let dayMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  if (window === "weekly") {
    dayMs -= ((new Date(dayMs).getUTCDay() + 6) % 7) * 86_400_000; // back to Monday
  }
  return new Date(dayMs - IST_OFFSET_MS);
}

/**
 * Start of the previous period → the closed window `[prevStart, curStart)` used for rank-movement.
 * Istanbul has a fixed +3 offset (no DST), so one period back is exactly `curStart − period`.
 * `null` for all_time (movement is meaningless with no period).
 */
export function previousWindowStart(window: LeaderboardWindow, curStart: Date): Date | null {
  if (window === "all_time") return null;
  const period = window === "today" ? 86_400_000 : 7 * 86_400_000;
  return new Date(curStart.getTime() - period);
}

/** Rank change vs the previous period. Lower rank number = better, so a smaller number is "up". */
export function computeMovement(previousRank: number | undefined, currentRank: number): RankMovement {
  if (previousRank === undefined) return "new";
  if (previousRank > currentRank) return "up";
  if (previousRank < currentRank) return "down";
  return "same";
}

/**
 * Movement for a row given the previous period's ranks. A null (all_time) or empty (first week)
 * baseline is suppressed to `null` — marking every row "new" against no history is noise, not signal.
 */
export function resolveMovement(
  previousRanks: Map<string, number> | null,
  userId: string,
  currentRank: number,
): RankMovement {
  if (!previousRanks || previousRanks.size === 0) return null;
  return computeMovement(previousRanks.get(userId), currentRank);
}
