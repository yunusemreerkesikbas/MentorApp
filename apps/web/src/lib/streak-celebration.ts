// The week row and the "did the streak just grow" rule are shared with the mobile app.
export {
  celebrationLitCount,
  celebrationWeekIsos,
  didStreakCreditToday,
  isCelebrationDayLit,
} from "@mentor/core";

const STORAGE_PREFIX = "mentor_streak_celebrated";

/** Same calendar-day math as plan-utils (UTC ISO date string). */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function storageKey(day = todayIso()): string {
  return `${STORAGE_PREFIX}:${day}`;
}

/** True when today's first streak credit was already celebrated on this device. */
export function hasCelebratedStreakToday(day = todayIso()): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(storageKey(day)) === "1";
  } catch {
    return true;
  }
}

/**
 * Atomically claims today's celebration slot. Returns true only the first time
 * per calendar day (localStorage) so panel + session cannot double-open.
 */
export function claimStreakCelebrationToday(day = todayIso()): boolean {
  if (typeof window === "undefined") return false;
  try {
    const key = storageKey(day);
    if (window.localStorage.getItem(key) === "1") return false;
    window.localStorage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}
