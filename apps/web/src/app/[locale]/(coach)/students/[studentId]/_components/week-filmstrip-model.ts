import type { MentorshipReportPlanTaskDto } from "@mentor/types";
import { seriesDates } from "../../../_components/activity-tone";

/**
 * The student page's calendar math. Every date is a `yyyy-mm-dd` string on the Europe/Istanbul
 * calendar (the API's day cut), so the arithmetic runs in UTC where no clock can shift a day.
 */

const DAY_MS = 86_400_000;

export function shiftIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Monday of the week that holds `iso`; a week runs Monday to Sunday. */
export function mondayOf(iso: string): string {
  const weekday = new Date(`${iso}T00:00:00.000Z`).getUTCDay();
  return shiftIso(iso, -((weekday + 6) % 7));
}

function minutesByDate(series: readonly number[], today: string): Map<string, number> {
  const dates = seriesDates(series.length, today);
  return new Map(dates.map((date, index) => [date, series[index] ?? 0]));
}

interface TaskCount {
  done: number;
  pending: number;
}

export interface FilmDay {
  date: string;
  kind: "past" | "today" | "future";
  /** Null on a day that has not come: it is drawn as a frame, not as zero. */
  minutes: number | null;
  /** What this coach assigned for the day. */
  coach: TaskCount;
  /** The student's own tasks, drawn smaller: the coach reads them, never grades them. */
  own: TaskCount;
}

/** This week, Monday to Sunday: the minutes studied so far and every task planned for each day. */
export function buildWeekFilm(
  series: readonly number[],
  tasks: readonly MentorshipReportPlanTaskDto[],
  today: string,
): FilmDay[] {
  const monday = mondayOf(today);
  const minutes = minutesByDate(series, today);
  const days = Array.from({ length: 7 }, (_, index): FilmDay => {
    const date = shiftIso(monday, index);
    const kind = date < today ? "past" : date === today ? "today" : "future";
    return {
      date,
      kind,
      minutes: kind === "future" ? null : (minutes.get(date) ?? 0),
      coach: { done: 0, pending: 0 },
      own: { done: 0, pending: 0 },
    };
  });
  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const task of tasks) {
    const day = byDate.get(task.taskDate);
    if (!day) continue;
    const count = task.assignedByCoach ? day.coach : day.own;
    if (task.status === "DONE") count.done += 1;
    else count.pending += 1;
  }
  return days;
}

/** The hero's two facts: minutes so far this week, and how much of what the coach gave is done. */
export function weekSummary(days: readonly FilmDay[]): {
  minutes: number;
  coachDone: number;
  coachTotal: number;
} {
  return days.reduce(
    (sum, day) => ({
      minutes: sum.minutes + (day.minutes ?? 0),
      coachDone: sum.coachDone + day.coach.done,
      coachTotal: sum.coachTotal + day.coach.done + day.coach.pending,
    }),
    { minutes: 0, coachDone: 0, coachTotal: 0 },
  );
}

export interface RhythmCell {
  date: string;
  /** Null on a day that has not come. */
  minutes: number | null;
}

/**
 * Four calendar weeks, Monday-first and ending with this one, so each row lines up with the week
 * above it. The totals cover the drawn days only: a number that counted a day the grid does not
 * show could not be checked against the grid.
 */
export function buildRhythm(
  series: readonly number[],
  today: string,
): { cells: RhythmCell[]; totalMinutes: number; activeDays: number } {
  const start = shiftIso(mondayOf(today), -21);
  const minutes = minutesByDate(series, today);
  const cells = Array.from({ length: 28 }, (_, index): RhythmCell => {
    const date = shiftIso(start, index);
    return { date, minutes: date > today ? null : (minutes.get(date) ?? 0) };
  });
  const drawn = cells.map((cell) => cell.minutes ?? 0);
  return {
    cells,
    totalMinutes: drawn.reduce((sum, value) => sum + value, 0),
    activeDays: drawn.filter((value) => value > 0).length,
  };
}

export type PlanGroupKey = "this_week" | "upcoming" | "last_week" | "earlier";

/**
 * The plan in the order a coach reads it: this week first (the filmstrip above it), then what is
 * already set for later, then what is behind. Oldest first inside a group, like a calendar.
 */
export function groupPlanTasks(
  tasks: readonly MentorshipReportPlanTaskDto[],
  today: string,
): { key: PlanGroupKey; tasks: MentorshipReportPlanTaskDto[] }[] {
  const monday = mondayOf(today);
  const nextMonday = shiftIso(monday, 7);
  const lastMonday = shiftIso(monday, -7);
  const keyOf = (date: string): PlanGroupKey =>
    date >= nextMonday
      ? "upcoming"
      : date >= monday
        ? "this_week"
        : date >= lastMonday
          ? "last_week"
          : "earlier";
  const order: PlanGroupKey[] = ["this_week", "upcoming", "last_week", "earlier"];
  const sorted = [...tasks].sort((a, b) => a.taskDate.localeCompare(b.taskDate));
  return order
    .map((key) => ({ key, tasks: sorted.filter((task) => keyOf(task.taskDate) === key) }))
    .filter((group) => group.tasks.length > 0);
}
