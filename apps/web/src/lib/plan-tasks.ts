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

export {
  planTaskControllerCreate as createPlanTask,
  planTaskControllerUpdate as updatePlanTask,
  planTaskControllerRemove as deletePlanTask,
};
export type { CreatePlanTaskInput, UpdatePlanTaskInput };
