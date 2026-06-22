import {
  approveMemberSchema,
  assignOwnerSchema,
  createZoneSchema,
  zoneListQuerySchema,
  zoneMembersQuerySchema,
} from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class CreateZoneDto extends createZodDto(createZoneSchema) {}
export class AssignOwnerDto extends createZodDto(assignOwnerSchema) {}
export class ApproveMemberDto extends createZodDto(approveMemberSchema) {}
export class ZoneListQueryDto extends createZodDto(zoneListQuerySchema) {}
export class ZoneMembersQueryDto extends createZodDto(zoneMembersQuerySchema) {}
