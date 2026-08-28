import {
  adminListArticlesQuerySchema,
  adminListExamsQuerySchema,
  adminForumTagCreateSchema,
  adminForumTagUpdateSchema,
  reviewForumTagSuggestionDtoSchema,
  articleImageUploadSchema,
  adminRefundSchema,
  adminUpdatePlanSchema,
  auditLogQuerySchema,
  createAnnouncementSchema,
  sendAnnouncementSchema,
  economyAdjustSchema,
  searchUsersQuerySchema,
  setFeaturedThreadSchema,
  updateConfigSchema,
  updateUserStatusSchema,
  upsertArticleSchema,
  upsertExamEventSchema,
  upsertExamSchema,
} from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class SearchUsersQueryDto extends createZodDto(searchUsersQuerySchema) {}
export class AuditLogQueryDto extends createZodDto(auditLogQuerySchema) {}
export class UpdateUserStatusDto extends createZodDto(updateUserStatusSchema) {}
export class UpdateConfigDto extends createZodDto(updateConfigSchema) {}
export class AdjustEconomyDto extends createZodDto(economyAdjustSchema) {}
export class AdminListArticlesQueryDto extends createZodDto(adminListArticlesQuerySchema) {}
export class UpsertArticleDto extends createZodDto(upsertArticleSchema) {}
export class ArticleImageUploadDto extends createZodDto(articleImageUploadSchema) {}
export class AdminListExamsQueryDto extends createZodDto(adminListExamsQuerySchema) {}
export class UpsertExamDto extends createZodDto(upsertExamSchema) {}
export class UpsertExamEventDto extends createZodDto(upsertExamEventSchema) {}
export class RefundSubscriptionDto extends createZodDto(adminRefundSchema) {}
export class UpdatePlanDto extends createZodDto(adminUpdatePlanSchema) {}
export class AdminForumTagCreateDto extends createZodDto(adminForumTagCreateSchema) {}
export class AdminForumTagUpdateDto extends createZodDto(adminForumTagUpdateSchema) {}
export class ReviewForumTagSuggestionDto extends createZodDto(reviewForumTagSuggestionDtoSchema) {}
export class SetFeaturedThreadDto extends createZodDto(setFeaturedThreadSchema) {}
export class CreateAnnouncementDto extends createZodDto(createAnnouncementSchema) {}
export class SendAnnouncementDto extends createZodDto(sendAnnouncementSchema) {}
