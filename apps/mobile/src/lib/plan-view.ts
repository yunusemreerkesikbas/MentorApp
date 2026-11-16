import {
  DEFAULT_EVENT_MINUTES, hhmmFromMinutes, minutesFromHhmm, monthStart, shiftDate,
  planTaskCreateInput, shiftMonth, weekDates, weekStart, type PlanTaskDraft, type PlanTaskFormValues,
} from "@mentor/core";
import type { PlanTaskDto, PlanTaskStatus } from "@mentor/types";
import type { CreateWeeklyReportTaskInput } from "@mentor/validation";

/** The web shell's week-change rule: keep the day if it is in the week, else today, else Monday. */
export function selectedDayForWeek(anchor: string, selected: string, today: string): string {
  const days = weekDates(anchor);
  if (days.includes(selected)) return selected;
  return days.includes(today) ? today : anchor;
}

/** Monday-first whole weeks covering the month of `monthIso`, outside-month days included. */
export function dateSheetMonthDays(monthIso: string): string[] {
  const first = monthStart(monthIso);
  const last = shiftDate(monthStart(shiftMonth(first, 1)), -1);
  const end = shiftDate(weekStart(last), 6);
  const days: string[] = [];
  for (let day = weekStart(first); day <= end; day = shiftDate(day, 1)) days.push(day);
  return days;
}

/** The same days, seven to a row: the date sheet lays out rows, not a wrapped grid. */
export function monthGridWeeks(monthIso: string): string[][] {
  const days = dateSheetMonthDays(monthIso);
  return Array.from({ length: days.length / 7 }, (_, index) =>
    days.slice(index * 7, index * 7 + 7),
  );
}

export function parsePlanDateLink(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

export function weeklyReportTaskInput(values: PlanTaskFormValues, taskDate: string): CreateWeeklyReportTaskInput {
  return planTaskCreateInput({ ...values, subject: "" }, taskDate);
}

export type PlanTaskPrefill = Pick<PlanTaskDraft, "title" | "subject">;

export function parsePlanTaskPrefill({ add, title, subject }: {
  add?: unknown;
  title?: unknown;
  subject?: unknown;
}): PlanTaskPrefill | null {
  if (add !== "1" || typeof title !== "string") return null;
  const draftTitle = title.trim().slice(0, 200);
  if (!draftTitle) return null;
  return {
    title: draftTitle,
    subject: typeof subject === "string" ? subject.trim().slice(0, 80) : "",
  };
}

export function newPlanTaskDraft(startTime?: string, prefill?: PlanTaskPrefill): PlanTaskDraft {
  return {
    title: prefill?.title ?? "",
    subject: prefill?.subject ?? "",
    allDay: startTime === undefined,
    startTime: startTime ?? "09:00",
    endTime: startTime ? hhmmFromMinutes(minutesFromHhmm(startTime) + DEFAULT_EVENT_MINUTES) : "10:00",
    description: "",
    duration: "",
  };
}

/** The optimistic tick: a copy with one task's status changed; other days keep their arrays. */
export function withTaskStatus(
  byDay: Record<string, PlanTaskDto[]>,
  id: string,
  status: PlanTaskStatus,
): Record<string, PlanTaskDto[]> {
  const next: Record<string, PlanTaskDto[]> = {};
  for (const [day, tasks] of Object.entries(byDay)) {
    next[day] = tasks.some((task) => task.id === id)
      ? tasks.map((task) => (task.id === id ? { ...task, status } : task))
      : tasks;
  }
  return next;
}

/**
 * What a failed write shows: the API's message (already localized), else the fallback. A fetch that
 * fails offline throws a TypeError in English ("Network request failed"), never shown as is.
 * Checks the name `ApiClientError` sets, the same test `instanceof` makes in the app.
 */
export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.name === "ApiClientError" ? error.message : fallback;
}

export interface PlanWeekView {
  /** The week's Monday. */
  anchor: string;
  selected: string;
}

/**
 * One arrow tap: the week moves from the PREVIOUS view, not from the rendered one, so a second tap
 * that lands before the re-render still moves another week.
 */
export function shiftPlanWeek(view: PlanWeekView, days: number, today: string): PlanWeekView {
  const anchor = shiftDate(view.anchor, days);
  return { anchor, selected: selectedDayForWeek(anchor, view.selected, today) };
}

/** The API's error code (`INSUFFICIENT_COIN`, …) for a failed write; null for anything else. */
export function apiErrorCode(error: unknown): string | null {
  if (!(error instanceof Error) || error.name !== "ApiClientError") return null;
  const code = (error as Error & { body?: { code?: unknown } }).body?.code;
  return typeof code === "string" ? code : null;
}
