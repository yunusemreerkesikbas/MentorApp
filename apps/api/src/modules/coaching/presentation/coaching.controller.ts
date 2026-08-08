import { Body, Controller, Delete, Get, HttpCode, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import type {
  MoodCheckinDto,
  Paginated,
  TodayPanelResponse,
  CoachingAnalysisDto,
  VisionBoardImageUploadUrlDto,
  VisionDto,
  WeeklyReviewDto,
  PreferenceSimulationAccessDto,
  PreferenceSimulationDto,
  PreferenceSimulationRefreshResultDto,
} from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { MoodService } from "../application/mood.service";
import { MockExamService } from "../application/mock-exam.service";
import { TodayService } from "../application/today.service";
import { VisionService } from "../application/vision.service";
import { VisionBoardImageService } from "../application/vision-board-image.service";
import { WeeklyReviewService } from "../application/weekly-review.service";
import { PreferenceSimulationService } from "../application/preference-simulation.service";
import {
  AnalysisQueryDto,
  CreateMoodCheckinDto,
  ListMoodCheckinsQueryDto,
  UpsertVisionDto,
  PutVisionBoardDto,
  CreateVisionBoardImageUploadUrlDto,
  WeeklyReviewQueryDto,
  PutPreferenceSimulationDto,
  RefreshPreferenceSimulationDto,
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
    private readonly visionBoardImages: VisionBoardImageService,
    private readonly weeklyReview: WeeklyReviewService,
    private readonly preferenceSimulation: PreferenceSimulationService,
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

  /**
   * Replace the collage document. Separate from the goal upsert on purpose — that one invalidates
   * the cached premium AI note when the goal changes, and rearranging a board is not that.
   * Read path is `GET vision` above, which already carries `board`.
   */
  @Put("vision/board")
  @HttpCode(200)
  putVisionBoard(
    @CurrentUser() user: RequestUser,
    @Body() dto: PutVisionBoardDto,
  ): Promise<VisionDto> {
    return this.vision.putBoard(user.id, dto.board);
  }

  /** Presigned direct-to-R2 upload for one board photo; the client then PUTs the bytes itself. */
  @Post("vision/board/image-upload-url")
  createVisionBoardImageUploadUrl(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateVisionBoardImageUploadUrlDto,
  ): Promise<VisionBoardImageUploadUrlDto> {
    return this.visionBoardImages.createUploadUrl(user.id, dto.contentType);
  }

  @Get("preference-simulation/access")
  getPreferenceSimulationAccess(
    @CurrentUser() user: RequestUser,
  ): Promise<PreferenceSimulationAccessDto> {
    return this.preferenceSimulation.getAccess(user.id);
  }

  @Get("preference-simulation")
  getPreferenceSimulation(
    @CurrentUser() user: RequestUser,
  ): Promise<PreferenceSimulationDto> {
    return this.preferenceSimulation.get({
      userId: user.id,
      organizationId: user.orgId,
    });
  }

  @Put("preference-simulation")
  putPreferenceSimulation(
    @CurrentUser() user: RequestUser,
    @Body() dto: PutPreferenceSimulationDto,
  ): Promise<PreferenceSimulationDto> {
    return this.preferenceSimulation.put(
      { userId: user.id, organizationId: user.orgId },
      dto,
    );
  }

  @Post("preference-simulation/refresh")
  @HttpCode(200)
  refreshPreferenceSimulation(
    @CurrentUser() user: RequestUser,
    @Body() dto: RefreshPreferenceSimulationDto,
  ): Promise<PreferenceSimulationRefreshResultDto> {
    return this.preferenceSimulation.refresh(
      { userId: user.id, organizationId: user.orgId },
      dto,
    );
  }

  @Delete("preference-simulation")
  @HttpCode(204)
  deletePreferenceSimulation(
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.preferenceSimulation.delete({
      userId: user.id,
      organizationId: user.orgId,
    });
  }
}





