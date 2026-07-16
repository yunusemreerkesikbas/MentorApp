import { Controller, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { DailyGreetingDto, MoodReflectionDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { DailyGreetingService } from "../application/daily-greeting.service";
import { MoodReflectionService } from "../application/mood-reflection.service";

/**
 * Premium AI-adaptive mood reflection + proactive daily greeting (W3). No body on either —
 * both ground on PII-free context and are idempotent per day (§4 #5 premium-only).
 */
@ApiTags("ai")
@ApiBearerAuth()
@Controller("coach")
export class AiMoodController {
  constructor(
    private readonly moodReflection: MoodReflectionService,
    private readonly dailyGreeting: DailyGreetingService,
  ) {}

  @Post("mood-reflection")
  @HttpCode(200)
  reflect(@CurrentUser() user: RequestUser): Promise<MoodReflectionDto> {
    return this.moodReflection.reflect(user);
  }

  @Post("daily-greeting")
  @HttpCode(200)
  greet(@CurrentUser() user: RequestUser): Promise<DailyGreetingDto> {
    return this.dailyGreeting.greet(user);
  }
}
