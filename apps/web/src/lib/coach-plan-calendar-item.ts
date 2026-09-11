/**
 * Coach calendar adapter. Pure: labels in, PlanCalendarItem out. Color is derived from the
 * attendee set so one student (or one cohort) always lands on the same swatch. Personal items
 * stay on the neutral token — color is "who", never "task vs event".
 */

import type { CoachPlanItemDto } from "@mentor/types";
import {
  planEventColor,
  planEventNeutralColor,
} from "./plan-event-colors";
import type { PlanCalendarItem } from "./plan-calendar-item";
import { coachPlanItemId, isCoachPlanItemShared } from "./coach-plan-calendar";

export interface CoachPlanItemLabels {
  personal: string;
  cancelled: string;
  hint: string;
}

export function coachPlanColorKey(item: CoachPlanItemDto): string | null {
  const people = item.kind === "TASK" ? item.task.participants : item.event.attendees;
  if (people.length === 0) return null;
  return [...new Set(people.map((person) => person.studentId))].sort().join("|");
}

export function coachPlanCalendarItem(
  item: CoachPlanItemDto,
  labels: CoachPlanItemLabels,
): PlanCalendarItem<CoachPlanItemDto> {
  const data = item.kind === "TASK" ? item.task : item.event;
  const date = item.kind === "TASK" ? item.task.taskDate : item.event.eventDate;
  const people = item.kind === "TASK" ? item.task.participants : item.event.attendees;
  const colorKey = coachPlanColorKey(item);
  const names = people.map((person) => person.studentDisplayName).join(", ");
  const cancelled = item.kind === "EVENT" && item.event.status === "CANCELLED";
  return {
    id: coachPlanItemId(item),
    date,
    title: data.title,
    startTime: data.startTime,
    endTime: data.endTime,
    color: colorKey ? planEventColor(colorKey) : planEventNeutralColor,
    meta: names || (isCoachPlanItemShared(item) ? null : labels.personal),
    groupKey: colorKey,
    muted: cancelled,
    glyph: item.kind === "TASK" ? "task" : "event",
    description:
      item.kind === "EVENT"
        ? item.event.description
        : item.task.coachNote,
    hint: cancelled ? labels.cancelled : labels.hint,
    source: item,
  };
}

export function coachPlanCalendarItems(
  items: readonly CoachPlanItemDto[],
  days: readonly string[],
  labels: CoachPlanItemLabels,
): Record<string, PlanCalendarItem<CoachPlanItemDto>[]> {
  const byDate: Record<string, PlanCalendarItem<CoachPlanItemDto>[]> = {};
  for (const iso of days) byDate[iso] = [];
  for (const item of items) {
    const row = coachPlanCalendarItem(item, labels);
    (byDate[row.date] ??= []).push(row);
  }
  return byDate;
}

export function coachPlanMarkedDates(items: readonly CoachPlanItemDto[]): string[] {
  return [
    ...new Set(
      items.map((item) =>
        item.kind === "TASK" ? item.task.taskDate : item.event.eventDate,
      ),
    ),
  ];
}
