import { aiChatSchema, categorizePhotoSchema, photoUploadUrlSchema, sessionReflectionSchema } from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class AiChatDto extends createZodDto(aiChatSchema) {}
export class PhotoUploadUrlDto extends createZodDto(photoUploadUrlSchema) {}
export class CategorizePhotoDto extends createZodDto(categorizePhotoSchema) {}
/** Request body for POST /v1/coach/session-reflection. */
export class SessionReflectionBodyDto extends createZodDto(sessionReflectionSchema) {}
