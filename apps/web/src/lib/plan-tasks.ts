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

/** List plan tasks in an inclusive date range — single request. */
export async function listPlanTasksForRange(
  from: string,
  to: string,
  pageSize = 100,
): Promise<PlanTaskDto[]> {
  const url = `${getPlanTaskControllerListUrl()}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=1&pageSize=${pageSize}`;
  const res = (await http<Paginated<PlanTaskDto>>(url)) as Paginated<PlanTaskDto>;
  return res.items;
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
