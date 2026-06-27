import type { Paginated, PlanTaskCalendarDto, PlanTaskDto } from "@mentor/types";
import {
  getPlanTaskControllerListUrl,
  http,
  planTaskControllerCreate,
  planTaskControllerRemove,
  planTaskControllerUpdate,
} from "@mentor/api-client";
import type { CreatePlanTaskInput, UpdatePlanTaskInput } from "@mentor/validation";

/** List plan tasks for a date — generated client omits the `date` query param. */
export async function listPlanTasksForDate(date: string, pageSize = 50): Promise<PlanTaskDto[]> {
  const url = `${getPlanTaskControllerListUrl()}?date=${encodeURIComponent(date)}&page=1&pageSize=${pageSize}`;
  const res = (await http<Paginated<PlanTaskDto>>(url)) as Paginated<PlanTaskDto>;
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

export async function updatePlanTask(
  id: string,
  input: Parameters<typeof planTaskControllerUpdate>[1],
): Promise<PlanTaskDto> {
  return (await planTaskControllerUpdate(id, input)) as unknown as PlanTaskDto;
}

/** ponytail: 7 parallel day fetches; add `from`/`to` list API when week view traffic grows. */
export async function listPlanTasksForWeek(
  weekStartDate: string,
): Promise<Record<string, PlanTaskDto[]>> {
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${weekStartDate}T12:00:00`);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const entries = await Promise.all(
    dates.map(async (date) => [date, await listPlanTasksForDate(date)] as const),
  );
  return Object.fromEntries(entries);
}

export { planTaskControllerRemove as deletePlanTask };
export type { CreatePlanTaskInput, UpdatePlanTaskInput };
