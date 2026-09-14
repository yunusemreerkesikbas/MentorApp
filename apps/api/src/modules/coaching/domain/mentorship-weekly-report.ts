import { weeklyReviewWindows } from "./weekly-review";

const DAY_MS = 86_400_000;
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

export interface MentorshipWeekPeriod {
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  timeZone: "Europe/Istanbul";
}

export interface MentorshipWeeklyTotals {
  focusMinutes: number;
  sessions: number;
  activeDays: number;
  plannedTasks: number;
  completedTasks: number;
}

export interface MentorshipWeeklyMetrics extends MentorshipWeeklyTotals {
  completionRate: number | null;
  hasRecordedActivity: boolean;
}

function isoDate(milliseconds: number): string {
  return new Date(milliseconds).toISOString().slice(0, 10);
}

function parseIsoDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("MENTORSHIP_WEEK_INVALID");
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(milliseconds) || isoDate(milliseconds) !== value) {
    throw new Error("MENTORSHIP_WEEK_INVALID");
  }
  return milliseconds;
}

/** A report always describes a completed Istanbul Monday-to-Sunday week. */
export function completedMentorshipWeek(
  now = new Date(),
  requestedStartDate?: string,
): MentorshipWeekPeriod {
  const localNow = new Date(now.getTime() + ISTANBUL_OFFSET_MS);
  const localDay = Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate(),
  );
  const currentWeekStart =
    localDay - ((new Date(localDay).getUTCDay() + 6) % 7) * DAY_MS;
  const start = requestedStartDate
    ? parseIsoDate(requestedStartDate)
    : parseIsoDate(weeklyReviewWindows(now).startDate);

  if (new Date(start).getUTCDay() !== 1 || start >= currentWeekStart) {
    throw new Error("MENTORSHIP_WEEK_INVALID");
  }

  return {
    startDate: isoDate(start),
    endDate: isoDate(start + 6 * DAY_MS),
    previousStartDate: isoDate(start - 7 * DAY_MS),
    previousEndDate: isoDate(start - DAY_MS),
    timeZone: "Europe/Istanbul",
  };
}

function metrics(totals: MentorshipWeeklyTotals): MentorshipWeeklyMetrics {
  return {
    ...totals,
    completionRate:
      totals.plannedTasks === 0
        ? null
        : totals.completedTasks / totals.plannedTasks,
    hasRecordedActivity:
      totals.sessions > 0 || totals.activeDays > 0 || totals.plannedTasks > 0,
  };
}

export function buildMentorshipWeeklyComparison(
  currentTotals: MentorshipWeeklyTotals,
  previousTotals: MentorshipWeeklyTotals,
) {
  const current = metrics(currentTotals);
  const previous = metrics(previousTotals);
  return {
    current,
    previous,
    deltas: {
      focusMinutes: current.focusMinutes - previous.focusMinutes,
      sessions: current.sessions - previous.sessions,
      activeDays: current.activeDays - previous.activeDays,
      plannedTasks: current.plannedTasks - previous.plannedTasks,
      completedTasks: current.completedTasks - previous.completedTasks,
      completionRate:
        current.completionRate === null || previous.completionRate === null
          ? null
          : current.completionRate - previous.completionRate,
    },
  };
}
