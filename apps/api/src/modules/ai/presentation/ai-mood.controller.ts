import { Controller, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { MoodReflectionDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { MoodReflectionService } from "../application/mood-reflection.service";

/**
 * Premium AI-adaptive mood reflection (W3). No body — grounds on today's persisted mood row.
 * Returns the cached reflection when one already exists (idempotent per day, §4 #5 premium-only).
 */
@ApiTags("ai")
@ApiBearerAuth()
@Controller("coach")
export class AiMoodController {
  constructor(private readonly moodReflection: MoodReflectionService) {}

  @Post("mood-reflection")
  @HttpCode(200)
  reflect(@CurrentUser() user: RequestUser): Promise<MoodReflectionDto> {
    return this.moodReflection.reflect(user);
  }
}
