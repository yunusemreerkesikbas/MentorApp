import {
  analysisQuerySchema,
  applyPlanAdaptationSchema,
  bulkCreatePlanTasksSchema,
  createMoodCheckinSchema,
  createMockExamSchema,
  createPlanTaskSchema,
  listMockExamsQuerySchema,
  listMoodCheckinsQuerySchema,
  listPlanTasksQuerySchema,
  listStudySessionsQuerySchema,
  planTaskCalendarQuerySchema,
  putPreferenceSimulationSchema,
  refreshPreferenceSimulationSchema,
  sessionFeedbackSchema,
  startStudySessionSchema,
  updateMockExamSchema,
  updatePlanTaskSchema,
  updateStudySessionSchema,
  upsertVisionSchema,
  weeklyReviewQuerySchema,
} from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class CreatePlanTaskDto extends createZodDto(createPlanTaskSchema) {}
/** Body for POST /v1/plan-tasks/bulk (user-confirmed batch add — e.g. accepted coach draft). */
export class BulkCreatePlanTasksDto extends createZodDto(bulkCreatePlanTasksSchema) {}
export class ApplyPlanAdaptationDto extends createZodDto(applyPlanAdaptationSchema) {}
export class UpdatePlanTaskDto extends createZodDto(updatePlanTaskSchema) {}
export class ListPlanTasksQueryDto extends createZodDto(listPlanTasksQuerySchema) {}
export class PlanTaskCalendarQueryDto extends createZodDto(planTaskCalendarQuerySchema) {}
export class StartStudySessionDto extends createZodDto(startStudySessionSchema) {}
export class UpdateStudySessionDto extends createZodDto(updateStudySessionSchema) {}
export class SessionFeedbackDto extends createZodDto(sessionFeedbackSchema) {}
export class ListStudySessionsQueryDto extends createZodDto(listStudySessionsQuerySchema) {}
export class CreateMoodCheckinDto extends createZodDto(createMoodCheckinSchema) {}
export class ListMoodCheckinsQueryDto extends createZodDto(listMoodCheckinsQuerySchema) {}
export class AnalysisQueryDto extends createZodDto(analysisQuerySchema) {}
export class WeeklyReviewQueryDto extends createZodDto(weeklyReviewQuerySchema) {}
export class CreateMockExamDto extends createZodDto(createMockExamSchema) {}
export class UpdateMockExamDto extends createZodDto(updateMockExamSchema) {}
export class ListMockExamsQueryDto extends createZodDto(listMockExamsQuerySchema) {}
export class UpsertVisionDto extends createZodDto(upsertVisionSchema) {}
export class PutPreferenceSimulationDto extends createZodDto(
  putPreferenceSimulationSchema,
) {}
export class RefreshPreferenceSimulationDto extends createZodDto(
  refreshPreferenceSimulationSchema,
) {}


