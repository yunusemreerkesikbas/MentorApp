import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { MoodCheckinDto, Paginated, TodayPanelResponse } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { MoodService } from "../application/mood.service";
import { TodayService } from "../application/today.service";
import { CreateMoodCheckinDto, ListMoodCheckinsQueryDto } from "./coaching.dto";

/** Coaching composite + mood endpoints. Authenticated self resource (global JwtAuthGuard applies). */
@ApiTags("coaching")
@ApiBearerAuth()
@Controller("coaching")
export class CoachingController {
  constructor(
    private readonly today: TodayService,
    private readonly mood: MoodService,
  ) {}

  /** Composite daily-hub payload for the Panel (one round-trip). */
  @Get("today")
  getToday(@CurrentUser() user: RequestUser): Promise<TodayPanelResponse> {
    return this.today.getToday(user.id);
  }

  /** Upsert today's mood → returns the rule-based, localized encouragement. */
  @Post("mood-checkins")
  @HttpCode(200)
  upsertMood(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateMoodCheckinDto,
  ): Promise<MoodCheckinDto> {
    return this.mood.upsertToday(user.id, dto.mood);
  }

  /** Mood trend (paginated, self). */
  @Get("mood-checkins")
  listMood(
    @CurrentUser() user: RequestUser,
    @Query() query: ListMoodCheckinsQueryDto,
  ): Promise<Paginated<MoodCheckinDto>> {
    return this.mood.list(user.id, query);
  }
}
