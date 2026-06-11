import { auditLogQuerySchema, searchUsersQuerySchema } from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class SearchUsersQueryDto extends createZodDto(searchUsersQuerySchema) {}
export class AuditLogQueryDto extends createZodDto(auditLogQuerySchema) {}
