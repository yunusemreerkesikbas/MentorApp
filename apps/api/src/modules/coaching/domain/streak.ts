/**
 * Pure streak derivation (critical domain logic — backend only, FE never recomputes).
 *
 * Rules (plan §3 Slice 2, AGENTS §0 anti-shaming):
 *  - A "streak day" is any day present in `activeDates` (≥1 completed session OR ≥1 done task —
 *    the caller decides membership from `daily_activity`).
 *  - Today not being active yet does NOT break the streak (the day is still in progress).
 *  - A SINGLE missed day can be bridged by one freeze token (monthly pool, anti-shaming).
 *  - Two consecutive missed days end the streak (soft reset), regardless of tokens.
 *
 * This function is intentionally idempotent: it always derives from `activeDates` + the
 * monthly freeze allowance, so repeated reads never double-spend tokens. The path to a
 * nightly `JobQueuePort` recompute (W5) only changes WHERE this is called, not the math.
 */
import { addDays, monthKey, type IsoDate } from "./date.util";

export interface StreakComputation {
  /** Current consecutive-day streak ending at today (or yesterday if today isn't active yet). */
  currentStreak: number;
  /** The missed days that were bridged by a freeze token (yyyy-mm-dd). */
  bridgedDates: IsoDate[];
}

/**
 * Derive the current streak by walking backward from `today` over `activeDates`.
 *
 * @param today                 server's "today" (yyyy-mm-dd)
 * @param activeDates           set of active calendar days (yyyy-mm-dd)
 * @param monthlyFreezeAllowance number of freeze tokens available to bridge single gaps
 */
export function deriveStreak(
  today: IsoDate,
  activeDates: ReadonlySet<IsoDate>,
  monthlyFreezeAllowance: number,
): StreakComputation {
  const bridgedDates: IsoDate[] = [];
  let streak = 0;

  // If today isn't active yet, measure the run ending yesterday (don't penalize an in-progress day).
  let cursor = activeDates.has(today) ? today : addDays(today, -1);
  let cursorMonth = monthKey(cursor);
  let freezesLeft = Math.max(0, monthlyFreezeAllowance);

  // Bound the walk defensively; the realistic cap is the caller's lookback window.
  for (let guard = 0; guard < 100_000; guard++) {
    const month = monthKey(cursor);
    if (month !== cursorMonth) {
      cursorMonth = month;
      freezesLeft = Math.max(0, monthlyFreezeAllowance);
    }

    if (activeDates.has(cursor)) {
      streak++;
      cursor = addDays(cursor, -1);
      continue;
    }
    // `cursor` is a missed day. Bridge it only if it's a SINGLE gap (the prior day is active)
    // and a freeze token is available; otherwise the streak ends here (soft reset).
    const previous = addDays(cursor, -1);
    if (freezesLeft > 0 && activeDates.has(previous)) {
      freezesLeft--;
      bridgedDates.push(cursor);
      cursor = previous;
      continue;
    }
    break;
  }

  return { currentStreak: streak, bridgedDates };
}
