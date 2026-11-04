import { weeklyRecapControllerTracking, weeklyRecapControllerCreateTask } from "@mentor/api-client";
import type { PlanTaskDto, WeeklyReportFollowUpDto } from "@mentor/types";
import type { CreateWeeklyReportTaskInput } from "@mentor/validation";

export async function fetchWeeklyReportFollowUp(reportId: string): Promise<WeeklyReportFollowUpDto> {
  return await weeklyRecapControllerTracking(reportId) as unknown as WeeklyReportFollowUpDto;
}

export async function createWeeklyReportTask(reportId: string, input: CreateWeeklyReportTaskInput): Promise<PlanTaskDto> {
  return await weeklyRecapControllerCreateTask(reportId, input) as unknown as PlanTaskDto;
}
