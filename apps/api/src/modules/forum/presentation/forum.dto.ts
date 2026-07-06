import {
  approveMemberSchema,
  assignOwnerSchema,
  attachmentUploadUrlSchema,
  createAnswerSchema,
  createReportSchema,
  createThreadSchema,
  createZoneSchema,
  feedQuerySchema,
  pinThreadSchema,
  reactionSchema,
  reportsQuerySchema,
  resolveReportSchema,
  searchQuerySchema,
  zoneListQuerySchema,
  zoneMembersQuerySchema,
} from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class CreateZoneDto extends createZodDto(createZoneSchema) {}
export class AssignOwnerDto extends createZodDto(assignOwnerSchema) {}
export class ApproveMemberDto extends createZodDto(approveMemberSchema) {}
export class ZoneListQueryDto extends createZodDto(zoneListQuerySchema) {}
export class ZoneMembersQueryDto extends createZodDto(zoneMembersQuerySchema) {}
export class CreateThreadDto extends createZodDto(createThreadSchema) {}
export class FeedQueryDto extends createZodDto(feedQuerySchema) {}
export class ReactionDto extends createZodDto(reactionSchema) {}
export class PinThreadDto extends createZodDto(pinThreadSchema) {}
export class CreateAnswerDto extends createZodDto(createAnswerSchema) {}
export class AttachmentUploadUrlDto extends createZodDto(attachmentUploadUrlSchema) {}
export class SearchQueryDto extends createZodDto(searchQuerySchema) {}
export class CreateReportDto extends createZodDto(createReportSchema) {}
export class ReportsQueryDto extends createZodDto(reportsQuerySchema) {}
export class ResolveReportDto extends createZodDto(resolveReportSchema) {}
