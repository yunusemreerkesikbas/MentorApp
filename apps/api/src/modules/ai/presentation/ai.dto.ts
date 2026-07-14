import {
  aiChatSchema,
  categorizePhotoSchema,
  coachFeedbackSchema,
  ghostNarrationSchema,
  paginationQuerySchema,
  photoUploadUrlSchema,
  sessionReflectionSchema,
  weeklyReviewNarrationSchema,
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
}
/** Query for GET /v1/coach/messages (plain pagination — study-sessions pattern). */
export class ListCoachMessagesQueryDto extends createZodDto(paginationQuerySchema) {}
/** Body for PATCH /v1/coach/messages/:id/feedback. */
export class CoachFeedbackDto extends createZodDto(coachFeedbackSchema) {}
export class PhotoUploadUrlDto extends createZodDto(photoUploadUrlSchema) {}
export class CategorizePhotoDto extends createZodDto(categorizePhotoSchema) {}
export class GhostNarrationBodyDto extends createZodDto(ghostNarrationSchema) {}
/** Request body for POST /v1/coach/session-reflection. */
export class SessionReflectionBodyDto extends createZodDto(sessionReflectionSchema) {}



export class WeeklyReviewNarrationBodyDto extends createZodDto(weeklyReviewNarrationSchema) {}

