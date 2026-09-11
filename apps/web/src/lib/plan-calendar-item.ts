/**
 * Role-agnostic calendar row. The Takvim surface (hour grid, month board, mobile strip/agenda,
 * hover preview) renders ONLY this shape, so the same components serve the student plan and the
 * coach plan without either DTO leaking into them.
 *
 * Convention shared with the API and `plan-calendar-layout`: `startTime === null` means ALL-DAY.
 * Times are wall-clock "HH:MM" on the item's own date — no timezone conversion anywhere.
 */

import type { ReactNode } from "react";
import type { PlanTaskDto } from "@mentor/types";
import { planEventColor, type PlanEventColor } from "./plan-event-colors";

export interface PlanCalendarItem<TSource = unknown> {
  id: string;
  date: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  color: PlanEventColor;
  /** Second line under the title: subject (student) / attendee summary (coach). */
  meta: string | null;
  /** Legend spotlight bucket — student uses the subject. Null opts the item out. */
  groupKey: string | null;
  /** Task vs event (coach). Student items omit this so the chip stays pixel-identical. */
  glyph?: "task" | "event";
  /** Struck through and faded: DONE (student), CANCELLED (coach). */
  muted: boolean;
  /** Optional leading node when `glyph` is not enough (unused by the current adapters). */
  icon?: ReactNode;
  /** Trailing slot in the `block` variant — the coach's avatar stack. */
  accessory?: ReactNode;
  /** Hover preview body. */
  description: string | null;
  /** Hover preview footer. */
  hint: string | null;
  source: TSource;
}

export interface PlanTaskItemLabels {
  /** Preview footer once the task is complete. */
  done: string;
  /** Preview footer while the task is open. */
  hint: string;
}

export function planTaskCalendarItem(
  task: PlanTaskDto,
  labels: PlanTaskItemLabels,
): PlanCalendarItem<PlanTaskDto> {
  const subject = task.subject?.trim() || null;
  return {
    id: task.id,
    date: task.taskDate,
    title: task.title,
    startTime: task.startTime,
    endTime: task.endTime,
    color: planEventColor(subject),
    meta: subject,
    groupKey: subject,
    muted: task.status === "DONE",
    description: task.description,
    hint: task.status === "DONE" ? labels.done : labels.hint,
    source: task,
  };
}

export function planTaskCalendarItems(
  tasksByDate: Record<string, PlanTaskDto[]>,
  labels: PlanTaskItemLabels,
): Record<string, PlanCalendarItem<PlanTaskDto>[]> {
  const byDate: Record<string, PlanCalendarItem<PlanTaskDto>[]> = {};
  for (const [iso, tasks] of Object.entries(tasksByDate)) {
    byDate[iso] = tasks.map((task) => planTaskCalendarItem(task, labels));
  }
  return byDate;
}
