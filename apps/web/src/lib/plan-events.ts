import type { Paginated, PlanEventDto } from "@mentor/types";
import { getPlanEventControllerListEventsUrl, http } from "@mentor/api-client";
import type { PlanCalendarItem } from "./plan-calendar-item";
import { planEventNeutralColor } from "./plan-event-colors";

/** API cap — `paginationQuerySchema` rejects anything larger. */
const MAX_PAGE_SIZE = 100;

/**
 * The events a student takes part in over an inclusive range: meetings their coach set up with
 * them, and any of their own. The API sends only an attendee count, never who else is invited.
 * Generated client omits the range query, like the plan-task list.
 */
export async function listPlanEventsForRange(from: string, to: string): Promise<PlanEventDto[]> {
  const pageUrl = (page: number) =>
    `${getPlanEventControllerListEventsUrl()}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=${page}&pageSize=${MAX_PAGE_SIZE}`;
  const first = (await http<Paginated<PlanEventDto>>(pageUrl(1))) as Paginated<PlanEventDto>;
  const pageCount = Math.ceil(first.total / MAX_PAGE_SIZE);
  if (pageCount <= 1) return first.items;
  const rest = await Promise.all(
    Array.from(
      { length: pageCount - 1 },
      (_, i) => http<Paginated<PlanEventDto>>(pageUrl(i + 2)) as Promise<Paginated<PlanEventDto>>,
    ),
  );
  return [...first.items, ...rest.flatMap((page) => page.items)];
}

export function groupPlanEventsByDate(events: PlanEventDto[]): Record<string, PlanEventDto[]> {
  const grouped: Record<string, PlanEventDto[]> = {};
  for (const event of events) (grouped[event.eventDate] ??= []).push(event);
  return grouped;
}

export interface StudentEventLabels {
  /** Second line of a meeting somebody else (the coach) set up with the student. */
  withCoach: string;
  cancelled: string;
}

/** An event on the student's own calendar. Read-only: a student can open it, not change it. */
export function studentEventCalendarItem(
  event: PlanEventDto,
  viewerId: string,
  labels: StudentEventLabels,
): PlanCalendarItem<PlanEventDto> {
  const cancelled = event.status === "CANCELLED";
  return {
    id: event.id,
    date: event.eventDate,
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime,
    color: planEventNeutralColor,
    meta: event.organizerUserId === viewerId ? null : labels.withCoach,
    groupKey: null,
    glyph: "event",
    muted: cancelled,
    description: event.description,
    hint: cancelled ? labels.cancelled : null,
    source: event,
  };
}
