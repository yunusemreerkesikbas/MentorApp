import type { Paginated, PlanTaskDto } from "@mentor/types";
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

export { planTaskControllerRemove as deletePlanTask };
export type { CreatePlanTaskInput, UpdatePlanTaskInput };
