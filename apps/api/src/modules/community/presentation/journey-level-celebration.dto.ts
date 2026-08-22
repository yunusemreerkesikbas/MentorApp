import { celebrateJourneyLevelSchema } from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class CelebrateJourneyLevelDto extends createZodDto(
  celebrateJourneyLevelSchema,
) {}
