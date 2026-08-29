import {
  adPlacementParamsSchema,
  adPlacementQuerySchema,
  adIdempotencyHeadersSchema,
  createAdRewardSessionSchema,
} from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class AdPlacementParamsDto extends createZodDto(adPlacementParamsSchema) {}
export class AdPlacementQueryDto extends createZodDto(adPlacementQuerySchema) {}
export class CreateAdRewardSessionDto extends createZodDto(createAdRewardSessionSchema) {}
export class AdIdempotencyHeadersDto extends createZodDto(adIdempotencyHeadersSchema) {}
