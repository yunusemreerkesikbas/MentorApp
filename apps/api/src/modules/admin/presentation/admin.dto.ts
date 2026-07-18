import {
  adminListArticlesQuerySchema,
  adminListExamsQuerySchema,
  articleImageUploadSchema,
  adminRefundSchema,
  auditLogQuerySchema,
  economyAdjustSchema,
  searchUsersQuerySchema,
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
