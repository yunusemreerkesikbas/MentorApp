import type { StreakSummaryDto, StreakWeekDayDto } from "@mentor/types";

/**
 * Monday→Sunday with nothing done. Specs that do not exercise the streak band take this as-is;
 * one that does builds its own week so the day it asserts on is obvious in the test, not here.
 */
export const IDLE_STREAK_WEEK: StreakWeekDayDto[] = [
  "2026-09-14",
  "2026-09-15",
  "2026-09-16",
  "2026-09-17",
  "2026-09-18",
  "2026-09-19",
  "2026-09-20",
].map((date) => ({ date, active: false, frozen: false }));

export const IDLE_STREAK: StreakSummaryDto = {
  currentStreak: 0,
  longestStreak: 0,
  freezeTokens: 2,
  week: IDLE_STREAK_WEEK,
};
