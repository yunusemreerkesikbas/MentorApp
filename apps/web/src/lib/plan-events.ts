import type { Paginated, PlanEventDto } from "@mentor/types";
import { getPlanEventControllerListEventsUrl, http } from "@mentor/api-client";
import { studentEventCalendarItem as coreStudentEventItem, type StudentEventLabels } from "@mentor/core";
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

export { groupPlanEventsByDate } from "@mentor/core";

export type { StudentEventLabels } from "@mentor/core";

/** An event on the student's own calendar. Read-only: a student can open it, not change it. */
export function studentEventCalendarItem(
  event: PlanEventDto,
  viewerId: string,
  labels: StudentEventLabels,
): PlanCalendarItem<PlanEventDto> {
  return coreStudentEventItem(event, viewerId, labels, planEventNeutralColor);
}
