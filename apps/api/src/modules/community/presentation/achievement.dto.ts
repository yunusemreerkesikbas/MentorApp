import { celebrateAchievementsSchema } from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class CelebrateAchievementsDto extends createZodDto(
  celebrateAchievementsSchema,
) {}
