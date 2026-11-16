/**
 * Role-agnostic calendar row. The shape and the task adapter live in `@mentor/core` (shared with
 * the mobile Takvim); the web adds its React-only slots and paints with CSS colors.
 *
 * Convention shared with the API and `plan-calendar-layout`: `startTime === null` means ALL-DAY.
 * Times are wall-clock "HH:MM" on the item's own date — no timezone conversion anywhere.
 */

import type { ReactNode } from "react";
import type { PlanTaskDto } from "@mentor/types";
import {
  planTaskCalendarItem as coreTaskItem,
  planTaskCalendarItems as coreTaskItems,
  type PlanCalendarItem as CorePlanCalendarItem,
  type PlanTaskItemLabels,
} from "@mentor/core";
import { planEventColor, type PlanEventColor } from "./plan-event-colors";

export type { PlanTaskItemLabels };

export interface PlanCalendarItem<TSource = unknown> extends CorePlanCalendarItem<TSource, PlanEventColor> {
  /** Optional leading node when `glyph` is not enough (unused by the current adapters). */
  icon?: ReactNode;
  /** Trailing slot in the `block` variant — the coach's avatar stack. */
  accessory?: ReactNode;
}

export function planTaskCalendarItem(
  task: PlanTaskDto,
  labels: PlanTaskItemLabels,
): PlanCalendarItem<PlanTaskDto> {
  return coreTaskItem(task, labels, planEventColor);
}

export function planTaskCalendarItems(
  tasksByDate: Record<string, PlanTaskDto[]>,
  labels: PlanTaskItemLabels,
): Record<string, PlanCalendarItem<PlanTaskDto>[]> {
  return coreTaskItems(tasksByDate, labels, planEventColor);
}
