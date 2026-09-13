import type { MentorshipReportPlanTaskDto } from "@mentor/types";
import { addDaysIso } from "./composer-dates";

export interface WeekStripDay {
  /** `yyyy-mm-dd` in the coach's local calendar, like the composer's day chips. */
  date: string;
  isToday: boolean;
  done: number;
  pending: number;
}

/**
 * The Monday-first week that contains `today`, with each day's done and pending task counts.
 *
 * Two states, not three: the report only knows DONE versus everything else, and a separate
 * "missed" mark would be the client deciding what a past PENDING row means. Future days of the
 * week are in: `planTasks` has no upper bound, so what the coach assigned for Friday shows here.
 */
export function buildWeekStrip(
  tasks: readonly MentorshipReportPlanTaskDto[],
  today: string,
): WeekStripDay[] {
  const weekday = new Date(`${today}T00:00:00`).getDay();
  const monday = addDaysIso(today, -((weekday + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDaysIso(monday, index);
    return { date, isToday: date === today, done: 0, pending: 0 };
  });
  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const task of tasks) {
    const day = byDate.get(task.taskDate);
    if (!day) continue;
    if (task.status === "DONE") day.done += 1;
    else day.pending += 1;
  }
  return days;
}

/**
 * How much of what THIS coach assigned got done, in the report's own 14-day window.
 *
 * Deliberately not `planCompletionRate7d`: that one covers everything the student planned, most of
 * which the coach never wrote. This is the only number on the screen that is about the coach.
 */
export function summarizeMine(tasks: readonly MentorshipReportPlanTaskDto[]): {
  done: number;
  total: number;
} {
  const mine = tasks.filter((task) => task.assignedByCoach);
  return { done: mine.filter((task) => task.status === "DONE").length, total: mine.length };
}
