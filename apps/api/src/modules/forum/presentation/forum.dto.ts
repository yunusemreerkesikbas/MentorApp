import {
  approveMemberSchema,
  assignOwnerSchema,
  createThreadSchema,
  createZoneSchema,
  feedQuerySchema,
  pinThreadSchema,
  reactionSchema,
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
