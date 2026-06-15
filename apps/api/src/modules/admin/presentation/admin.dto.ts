import {
  adminListArticlesQuerySchema,
  auditLogQuerySchema,
  economyAdjustSchema,
  searchUsersQuerySchema,
  updateConfigSchema,
  updateUserStatusSchema,
  upsertArticleSchema,
} from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class SearchUsersQueryDto extends createZodDto(searchUsersQuerySchema) {}
export class AuditLogQueryDto extends createZodDto(auditLogQuerySchema) {}
export class UpdateUserStatusDto extends createZodDto(updateUserStatusSchema) {}
export class UpdateConfigDto extends createZodDto(updateConfigSchema) {}
export class AdjustEconomyDto extends createZodDto(economyAdjustSchema) {}
export class AdminListArticlesQueryDto extends createZodDto(adminListArticlesQuerySchema) {}
export class UpsertArticleDto extends createZodDto(upsertArticleSchema) {}
