import {
  aiChatSchema,
  categorizePhotoSchema,
  ghostNarrationSchema,
  paginationQuerySchema,
  photoUploadUrlSchema,
  sessionReflectionSchema,
  weeklyReviewNarrationSchema,
} from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class AiChatDto extends createZodDto(aiChatSchema) {}
/** Query for GET /v1/coach/messages (plain pagination — study-sessions pattern). */
export class ListCoachMessagesQueryDto extends createZodDto(paginationQuerySchema) {}
export class PhotoUploadUrlDto extends createZodDto(photoUploadUrlSchema) {}
export class CategorizePhotoDto extends createZodDto(categorizePhotoSchema) {}
export class GhostNarrationBodyDto extends createZodDto(ghostNarrationSchema) {}
/** Request body for POST /v1/coach/session-reflection. */
export class SessionReflectionBodyDto extends createZodDto(sessionReflectionSchema) {}



export class WeeklyReviewNarrationBodyDto extends createZodDto(weeklyReviewNarrationSchema) {}

