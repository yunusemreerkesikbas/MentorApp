import {
  analysisQuerySchema,
  createMoodCheckinSchema,
  createMockExamSchema,
  createPlanTaskSchema,
  listMockExamsQuerySchema,
  listMoodCheckinsQuerySchema,
  listPlanTasksQuerySchema,
  listStudySessionsQuerySchema,
  planTaskCalendarQuerySchema,
  sessionFeedbackSchema,
  startStudySessionSchema,
  updateMockExamSchema,
  updatePlanTaskSchema,
  updateStudySessionSchema,
  upsertVisionSchema,
} from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class CreatePlanTaskDto extends createZodDto(createPlanTaskSchema) {}
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
export class CreateMockExamDto extends createZodDto(createMockExamSchema) {}
export class UpdateMockExamDto extends createZodDto(updateMockExamSchema) {}
export class ListMockExamsQueryDto extends createZodDto(listMockExamsQuerySchema) {}
export class UpsertVisionDto extends createZodDto(upsertVisionSchema) {}
