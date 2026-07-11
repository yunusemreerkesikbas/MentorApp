import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import type {
  MoodCheckinDto,
  Paginated,
  TodayPanelResponse,
  CoachingAnalysisDto,
  VisionDto,
  WeeklyReviewDto,
} from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { MoodService } from "../application/mood.service";
import { MockExamService } from "../application/mock-exam.service";
import { TodayService } from "../application/today.service";
import { VisionService } from "../application/vision.service";
import { WeeklyReviewService } from "../application/weekly-review.service";
import {
  AnalysisQueryDto,
  CreateMoodCheckinDto,
  ListMoodCheckinsQueryDto,
  UpsertVisionDto,
  WeeklyReviewQueryDto,
} from "./coaching.dto";

/** Coaching composite + mood endpoints. Authenticated self resource (global JwtAuthGuard applies). */
@ApiTags("coaching")
@ApiBearerAuth()
@Controller("coaching")
export class CoachingController {
  constructor(
    private readonly today: TodayService,
    private readonly mood: MoodService,
    private readonly mockExams: MockExamService,
    private readonly vision: VisionService,
    private readonly weeklyReview: WeeklyReviewService,
  ) {}

  /** Composite daily-hub payload for the Panel (one round-trip). */
  @Get("today")
  getToday(@CurrentUser() user: RequestUser): Promise<TodayPanelResponse> {
    return this.today.getToday(user.id);
  }

  /** Personal deneme analysis — net trend + subject strength/weakness (no ranking). */
  @Get("analysis")
  @ApiQuery({ name: "examId", required: false, type: String, format: "uuid" })
  getAnalysis(
    @CurrentUser() user: RequestUser,
    @Query() query: AnalysisQueryDto,
  ): Promise<CoachingAnalysisDto> {
    return this.mockExams.getAnalysis(user.id, query.examId);
  }

  /** Previous completed week, scoped to the active exam. */
  @Get("weekly-review")
  @ApiQuery({ name: "examId", required: true, type: String, format: "uuid" })
  getWeeklyReview(
    @CurrentUser() user: RequestUser,
    @Query() query: WeeklyReviewQueryDto,
  ): Promise<WeeklyReviewDto> {
    return this.weeklyReview.getReview(user.id, query.examId);
  }

  /** Upsert today's mood → returns the rule-based, localized encouragement. */
  @Post("mood-checkins")
  @HttpCode(200)
  upsertMood(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateMoodCheckinDto,
  ): Promise<MoodCheckinDto> {
    return this.mood.upsertToday(user.id, dto.mood, dto.struggleNote);
  }

  /** Mood trend (paginated, self). */
  @Get("mood-checkins")
  listMood(
    @CurrentUser() user: RequestUser,
    @Query() query: ListMoodCheckinsQueryDto,
  ): Promise<Paginated<MoodCheckinDto>> {
    return this.mood.list(user.id, query);
  }

  /** The user's vision/goal board ("hayal/hedef panosu"); `null` when not set yet. */
  @Get("vision")
  getVision(@CurrentUser() user: RequestUser): Promise<VisionDto | null> {
    return this.vision.getMine(user.id);
  }

  /** Upsert the user's single vision/goal board (idempotent by user; mirrors mood's POST+200). */
  @Post("vision")
  @HttpCode(200)
  upsertVision(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpsertVisionDto,
  ): Promise<VisionDto> {
    return this.vision.upsert(user.id, dto);
  }
}





