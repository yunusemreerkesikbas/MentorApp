import {
  analysisQuerySchema,
  applyPlanAdaptationSchema,
  bulkCreatePlanTasksSchema,
  createMoodCheckinSchema,
  createMockExamSchema,
  createNotebookEntrySchema,
  createNotebookSchema,
  createPlanTaskSchema,
  linkNotebookThreadSchema,
  listNotebookEntriesQuerySchema,
  listNotebooksQuerySchema,
  notebookImageUploadUrlSchema,
  putNotebookPageSchema,
  reviewNotebookEntrySchema,
  updateNotebookEntrySchema,
  updateNotebookSchema,
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
  putVisionBoardSchema,
  visionBoardImageUploadUrlSchema,
  weeklyReviewQuerySchema,
  completeWeeklyReviewSchema,
  createStudyRoomSchema,
  updateStudyRoomSchema,
  joinStudyRoomSchema,
} from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class CreatePlanTaskDto extends createZodDto(createPlanTaskSchema) {}
/** Body for POST /v1/plan-tasks/bulk (user-confirmed batch add — e.g. accepted coach draft). */
export class BulkCreatePlanTasksDto extends createZodDto(
  bulkCreatePlanTasksSchema,
) {}
export class ApplyPlanAdaptationDto extends createZodDto(
  applyPlanAdaptationSchema,
) {}
export class UpdatePlanTaskDto extends createZodDto(updatePlanTaskSchema) {}
export class ListPlanTasksQueryDto extends createZodDto(
  listPlanTasksQuerySchema,
) {}
export class PlanTaskCalendarQueryDto extends createZodDto(
  planTaskCalendarQuerySchema,
) {}
export class StartStudySessionDto extends createZodDto(
  startStudySessionSchema,
) {}
export class UpdateStudySessionDto extends createZodDto(
  updateStudySessionSchema,
) {}
export class SessionFeedbackDto extends createZodDto(sessionFeedbackSchema) {}
export class ListStudySessionsQueryDto extends createZodDto(
  listStudySessionsQuerySchema,
) {}
export class CreateStudyRoomDto extends createZodDto(createStudyRoomSchema) {}
export class UpdateStudyRoomDto extends createZodDto(updateStudyRoomSchema) {}
export class JoinStudyRoomDto extends createZodDto(joinStudyRoomSchema) {}
export class CreateMoodCheckinDto extends createZodDto(
  createMoodCheckinSchema,
) {}
export class ListMoodCheckinsQueryDto extends createZodDto(
  listMoodCheckinsQuerySchema,
) {}
export class AnalysisQueryDto extends createZodDto(analysisQuerySchema) {}
export class WeeklyReviewQueryDto extends createZodDto(
  weeklyReviewQuerySchema,
) {}
export class CompleteWeeklyReviewDto extends createZodDto(
  completeWeeklyReviewSchema,
) {}
export class CreateMockExamDto extends createZodDto(createMockExamSchema) {}
export class UpdateMockExamDto extends createZodDto(updateMockExamSchema) {}
export class ListMockExamsQueryDto extends createZodDto(
  listMockExamsQuerySchema,
) {}
export class UpsertVisionDto extends createZodDto(upsertVisionSchema) {}
/** Body for PUT /v1/coaching/vision/board — the whole collage document, replaced wholesale. */
export class PutVisionBoardDto extends createZodDto(putVisionBoardSchema) {}
/** Body for the presign call. Named `Create…` so it doesn't collide with the response DTO type. */
export class CreateVisionBoardImageUploadUrlDto extends createZodDto(
  visionBoardImageUploadUrlSchema,
) {}
export class PutPreferenceSimulationDto extends createZodDto(
  putPreferenceSimulationSchema,
) {}
export class RefreshPreferenceSimulationDto extends createZodDto(
  refreshPreferenceSimulationSchema,
) {}

export class CreateNotebookEntryDto extends createZodDto(
  createNotebookEntrySchema,
) {}
export class CreateNotebookDto extends createZodDto(createNotebookSchema) {}
export class UpdateNotebookDto extends createZodDto(updateNotebookSchema) {}
export class ListNotebooksQueryDto extends createZodDto(
  listNotebooksQuerySchema,
) {}
export class ListNotebookEntriesQueryDto extends createZodDto(
  listNotebookEntriesQuerySchema,
) {}
export class UpdateNotebookEntryDto extends createZodDto(
  updateNotebookEntrySchema,
) {}
export class ReviewNotebookEntryDto extends createZodDto(
  reviewNotebookEntrySchema,
) {}
export class PutNotebookPageDto extends createZodDto(putNotebookPageSchema) {}
export class LinkNotebookThreadDto extends createZodDto(
  linkNotebookThreadSchema,
) {}
export class NotebookImageUploadUrlDto extends createZodDto(
  notebookImageUploadUrlSchema,
) {}
