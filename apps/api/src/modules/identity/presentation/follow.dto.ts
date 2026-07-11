import { followListQuerySchema } from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class FollowListQueryDto extends createZodDto(followListQuerySchema) {}
