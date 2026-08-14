import {
  aiChatSchema,
  coachPlanAdaptationSchema,
  categorizePhotoSchema,
  planDraftSchema,
  coachFeedbackSchema,
  createPlanTaskSchema,
  ghostNarrationSchema,
  paginationQuerySchema,
  photoUploadUrlSchema,
  prelabelNotebookEntrySchema,
  sessionReflectionSchema,
  weeklyReviewNarrationSchema,
  coachProfilePatchSchema,
  coachMemoryFactPatchSchema,
  coachActionDecisionSchema,
} from "@mentor/validation";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { createZodDto } from "../../../common/validation/zod-dto";

export class AiChatDto extends createZodDto(aiChatSchema) {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  override message!: string;

  @ApiPropertyOptional({ format: "uuid" })
  override clientMessageId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  override conversationId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  override contextMockExamId?: string;

  @ApiPropertyOptional({ maxLength: 128, pattern: "^[a-z0-9-]+$" })
  override contextArticleSlug?: string;
}

/** User-confirmed plan task body; community provenance is resolved from the path conversation. */
export class CommunityCoachPlanTaskDto extends createZodDto(
  createPlanTaskSchema,
) {}
/** Body for POST /v1/coach/plan-draft (optional free-text wish). */
export class PlanDraftBodyDto extends createZodDto(planDraftSchema) {
  @ApiPropertyOptional({ maxLength: 500 })
  override note?: string;
}

/** Body for POST /v1/coach/plan-adaptation. */
export class PlanAdaptationBodyDto extends createZodDto(
  coachPlanAdaptationSchema,
) {
  @ApiProperty({ enum: ["PLAN", "MOOD", "SESSION"] })
  override source!: "PLAN" | "MOOD" | "SESSION";

  @ApiPropertyOptional({ maxLength: 500 })
  override note?: string;

  @ApiPropertyOptional({ format: "uuid" })
  override sessionId?: string;
}
/** Query for GET /v1/coach/messages (plain pagination — study-sessions pattern). */
export class ListCoachMessagesQueryDto extends createZodDto(
  paginationQuerySchema,
) {}
/** Body for PATCH /v1/coach/messages/:id/feedback. */
export class CoachFeedbackDto extends createZodDto(coachFeedbackSchema) {}
export class CoachProfilePatchDto extends createZodDto(
  coachProfilePatchSchema,
) {
  @ApiPropertyOptional({
    enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "SKIPPED"],
  })
  override calibrationStatus?:
    | "NOT_STARTED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "SKIPPED";

  @ApiPropertyOptional({ enum: ["PENDING", "GRANTED", "DECLINED"] })
  override memoryConsent?: "PENDING" | "GRANTED" | "DECLINED";

  @ApiPropertyOptional({
    enum: ["EMOTIONAL", "BALANCED", "ACTION"],
    nullable: true,
  })
  override supportPreference?: "EMOTIONAL" | "BALANCED" | "ACTION" | null;

  @ApiPropertyOptional({
    enum: ["GENTLE", "BALANCED", "DIRECT"],
    nullable: true,
  })
  override directnessPreference?: "GENTLE" | "BALANCED" | "DIRECT" | null;
}
export class CoachMemoryFactPatchDto extends createZodDto(
  coachMemoryFactPatchSchema,
) {
  @ApiProperty({ minLength: 1, maxLength: 80 })
  override value!: string;
}
export class CoachActionDecisionDto extends createZodDto(
  coachActionDecisionSchema,
) {
  @ApiProperty({ enum: ["ACCEPT", "CANCEL"] })
  override decision!: "ACCEPT" | "CANCEL";
}
export class PhotoUploadUrlDto extends createZodDto(photoUploadUrlSchema) {}
export class CategorizePhotoDto extends createZodDto(categorizePhotoSchema) {}
export class GhostNarrationBodyDto extends createZodDto(ghostNarrationSchema) {}
/** Request body for POST /v1/coach/session-reflection. */
export class SessionReflectionBodyDto extends createZodDto(
  sessionReflectionSchema,
) {}

export class WeeklyReviewNarrationBodyDto extends createZodDto(
  weeklyReviewNarrationSchema,
) {}

export class PrelabelNotebookEntryDto extends createZodDto(
  prelabelNotebookEntrySchema,
) {}
