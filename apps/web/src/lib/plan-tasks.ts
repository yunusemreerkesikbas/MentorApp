import type {
  ApplyPlanAdaptationResultDto,
  Paginated,
  PlanTaskCalendarDto,
  PlanTaskDto,
  PublicHolidayDto,
} from "@mentor/types";
import {
  getPlanTaskControllerListUrl,
  http,
  planTaskControllerCreate,
  planTaskControllerRemove,
  planTaskControllerUpdate,
} from "@mentor/api-client";
import type {
  ApplyPlanAdaptationInput,
  CreatePlanTaskInput,
  UpdatePlanTaskInput,
} from "@mentor/validation";

/** List plan tasks for a date — generated client omits the `date` query param. */
export async function listPlanTasksForDate(
  date: string,
  pageSize = 50,
): Promise<PlanTaskDto[]> {
  const url = `${getPlanTaskControllerListUrl()}?date=${encodeURIComponent(date)}&page=1&pageSize=${pageSize}`;
  const res = (await http<Paginated<PlanTaskDto>>(
    url,
  )) as Paginated<PlanTaskDto>;
  return res.items;
}

/** Distinct dates with ≥1 task in range — one request for calendar dots. */
export async function listPlanTaskCalendarDates(
  from: string,
  to: string,
): Promise<string[]> {
  const url = `${getPlanTaskControllerListUrl()}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const res = (await http<PlanTaskCalendarDto>(url)) as PlanTaskCalendarDto;
  return res.dates;
}

/**
 * Typed wrappers over the generated plan-task client. The API DTOs are `type` aliases, so the
 * orval-generated client types mutation responses as `void`; we assert the real `PlanTaskDto` shape
 * here (one place) so components stay cast-free. (Backlog: Swagger response classes API-wide.)
 */
export async function createPlanTask(
  input: Parameters<typeof planTaskControllerCreate>[0],
): Promise<PlanTaskDto> {
  return (await planTaskControllerCreate(input)) as unknown as PlanTaskDto;
}

/** Apply the user's selected coach preview all-or-nothing. */
export async function applyCoachPlanAdaptation(
  input: ApplyPlanAdaptationInput,
): Promise<ApplyPlanAdaptationResultDto> {
  return (await http<ApplyPlanAdaptationResultDto>("/v1/plan-tasks/adapt", {
    method: "POST",
    body: JSON.stringify(input),
  })) as ApplyPlanAdaptationResultDto;
}

export async function updatePlanTask(
  id: string,
  input: Parameters<typeof planTaskControllerUpdate>[1],
): Promise<PlanTaskDto> {
  return (await planTaskControllerUpdate(id, input)) as unknown as PlanTaskDto;
}

/** Group flat task list by ISO taskDate. */
export function groupPlanTasksByDate(
  items: PlanTaskDto[],
): Record<string, PlanTaskDto[]> {
  const grouped: Record<string, PlanTaskDto[]> = {};
  for (const task of items) {
    const list = grouped[task.taskDate] ?? [];
    list.push(task);
    grouped[task.taskDate] = list;
  }
  return grouped;
}

/** API cap — `paginationQuerySchema` rejects anything larger. */
const MAX_PAGE_SIZE = 100;

/**
 * List plan tasks in an inclusive date range. A month grid spans up to 42 days, which can hold
 * more than one page, so any remaining pages are fetched in parallel rather than silently
 * truncating the calendar.
 */
export async function listPlanTasksForRange(
  from: string,
  to: string,
): Promise<PlanTaskDto[]> {
  const pageUrl = (page: number) =>
    `${getPlanTaskControllerListUrl()}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=${page}&pageSize=${MAX_PAGE_SIZE}`;

  const first = (await http<Paginated<PlanTaskDto>>(
    pageUrl(1),
  )) as Paginated<PlanTaskDto>;

  const pageCount = Math.ceil(first.total / MAX_PAGE_SIZE);
  if (pageCount <= 1) return first.items;

  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, i) =>
      http<Paginated<PlanTaskDto>>(pageUrl(i + 2)) as Promise<Paginated<PlanTaskDto>>,
    ),
  );
  return [...first.items, ...rest.flatMap((page) => page.items)];
}

/**
 * Verified public holidays for a range, keyed by ISO date. Editorial reference data — the client
 * never derives holidays itself (guardrail §4 #1), and a missing range just renders none.
 */
export async function listPublicHolidaysByDate(
  from: string,
  to: string,
): Promise<Record<string, PublicHolidayDto>> {
  const url = `/v1/content/holidays?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const items = (await http<PublicHolidayDto[]>(url)) as PublicHolidayDto[];
  const byDate: Record<string, PublicHolidayDto> = {};
  for (const holiday of items) byDate[holiday.date] = holiday;
  return byDate;
}

/**
 * Tasks for the whole 6×7 month board, keyed by ISO date. 42 days stays under the API's 62-day
 * range cap, so this is one range query (plus extra pages when the month is busy).
 */
export async function listPlanTasksForMonthGrid(
  days: string[],
): Promise<Record<string, PlanTaskDto[]>> {
  const from = days[0]!;
  const to = days[days.length - 1]!;
  const grouped = groupPlanTasksByDate(await listPlanTasksForRange(from, to));
  for (const iso of days) grouped[iso] ??= [];
  return grouped;
}

/** Week tasks keyed by ISO date (Monday-start week). */
export async function listPlanTasksForWeek(
  weekStartDate: string,
): Promise<Record<string, PlanTaskDto[]>> {
  const end = new Date(`${weekStartDate}T12:00:00`);
  end.setDate(end.getDate() + 6);
  const weekEnd = end.toISOString().slice(0, 10);
  const grouped = groupPlanTasksByDate(
    await listPlanTasksForRange(weekStartDate, weekEnd),
  );
  const start = new Date(`${weekStartDate}T12:00:00`);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    if (!grouped[iso]) grouped[iso] = [];
  }
  return grouped;
}

export { planTaskControllerRemove as deletePlanTask };
export type { CreatePlanTaskInput, UpdatePlanTaskInput };
