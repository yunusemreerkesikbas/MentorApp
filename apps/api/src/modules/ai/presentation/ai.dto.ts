import { aiChatSchema, categorizePhotoSchema, photoUploadUrlSchema } from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class AiChatDto extends createZodDto(aiChatSchema) {}
export class PhotoUploadUrlDto extends createZodDto(photoUploadUrlSchema) {}
export class CategorizePhotoDto extends createZodDto(categorizePhotoSchema) {}
