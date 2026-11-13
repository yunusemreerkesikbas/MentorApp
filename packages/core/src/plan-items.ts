import type { PlanEventDto, PlanTaskDto } from "@mentor/types";

const CLOCK = /^(\d{1,2}):(\d{2})$/;
const MINUTE_STEP = 5;

/** Zero-padded `HH:mm`, or null when the text is not a clock time. */
export function canonicalHm(value: string): string | null {
  const match = CLOCK.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

/** Five-minute ticks, plus the current minute when it falls off the grid. */
export function minuteChoices(minute: number | null): number[] {
  const steps = Array.from({ length: 60 / MINUTE_STEP }, (_, index) => index * MINUTE_STEP);
  if (minute === null || steps.includes(minute)) return steps;
  return [...steps, minute].sort((left, right) => left - right);
}

export function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * A task assigned by the student's human coach (W8).
 *
 * The API lets the student complete or delete it but refuses any content edit
 * (`COACHING_TASK_COACH_ASSIGNED`), because a rewritten title would make the coach's report
 * quietly untrue. Every surface that offers an edit control must ask this first — an edit button
 * that always 403s is worse than no button.
 */
export function isCoachAssigned(task: Pick<PlanTaskDto, "origin">): boolean {
  return task.origin?.type === "MENTORSHIP";
}

/**
 * The subject an edit must keep: an analysis task is tied to its verified focus (the API answers a
 * change with 409 `ANALYSIS_FOCUS_CHANGED`) and a weekly-report task keeps the report's subject.
 * `subject: null` means the routine itself; the caller names it ("Çalışma düzenin").
 */
export function planTaskLockedFocus(
  task: Pick<PlanTaskDto, "origin" | "subject" | "topic">,
): { subject: string | null; topic: string | null } | null {
  const type = task.origin?.type;
  return type === "ANALYSIS" || type === "WEEKLY_REPORT"
    ? { subject: task.subject, topic: task.topic }
    : null;
}

export function groupPlanEventsByDate(events: PlanEventDto[]): Record<string, PlanEventDto[]> {
  const grouped: Record<string, PlanEventDto[]> = {};
  for (const event of events) (grouped[event.eventDate] ??= []).push(event);
  return grouped;
}
