const CELEBRATION_WEEK_SLOTS = 7;

/** Same calendar-day math as the plan utilities (UTC ISO date string). */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** How many day slots light up from the left (capped at one week). Title can still show 15+. */
export function celebrationLitCount(streakDays: number): number {
  if (!Number.isFinite(streakDays) || streakDays <= 0) return 0;
  return Math.min(Math.floor(streakDays), CELEBRATION_WEEK_SLOTS);
}

/**
 * Seven calendar days starting at the first lit streak day (left), through today, then future.
 * Example: 2-day streak on 2026-07-25 → Fri 24 … Thu 30 (first two lit).
 */
export function celebrationWeekIsos(streakDays: number, today = todayIso()): string[] {
  const lit = Math.max(celebrationLitCount(streakDays), 1);
  const startOffset = -(lit - 1);
  return Array.from({ length: CELEBRATION_WEEK_SLOTS }, (_, index) =>
    shiftDate(today, startOffset + index),
  );
}

/** Slot `index` (0..6) is lit when it is among the leading streak days. */
export function isCelebrationDayLit(index: number, streakDays: number): boolean {
  const lit = celebrationLitCount(streakDays);
  return lit > 0 && index < lit;
}

/**
 * Streak just grew after a counting action (valid session / task DONE).
 * `next > prev` covers both first-day start (0→1) and keep (n→n+1).
 */
export function didStreakCreditToday(previousStreak: number, nextStreak: number): boolean {
  return nextStreak > 0 && nextStreak > previousStreak;
}
