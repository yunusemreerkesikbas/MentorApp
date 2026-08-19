import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { I18nLang } from "nestjs-i18n";
import type {
  AchievementCelebrationsDto,
  AchievementCollectionDto,
  CommunitySummary,
  LeaderboardView,
  PublicProfile,
} from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { AchievementService } from "../application/achievement.service";
import { CommunityService } from "../application/community.service";
import { toWindow } from "../domain/leaderboard-window";
import { CelebrateAchievementsDto } from "./achievement.dto";

/**
 * Community right-column effort board. Self-scoped read; the whole payload is about the viewer's
 * own standing, so no feature-flag 404 — economy fields degrade to null when `economy.enabled` is off.
 */
@ApiTags("community")
@ApiBearerAuth()
@Controller("community")
export class CommunityController {
  constructor(
    private readonly community: CommunityService,
    private readonly achievements: AchievementService,
  ) {}

  @Get("summary")
  getSummary(@CurrentUser() user: RequestUser): Promise<CommunitySummary> {
    return this.community.getSummary(user.id);
  }

  /** Public profile header (identity + gamification) of another user, by username. Unknown → 404. */
  @Get("profile/:username")
  getProfile(
    @CurrentUser() user: RequestUser,
    @Param("username") username: string,
  ): Promise<PublicProfile> {
    return this.community.getPublicProfile(username, user.id);
  }

  @Get("profile/:username/achievements")
  getAchievements(
    @CurrentUser() user: RequestUser,
    @Param("username") username: string,
    @I18nLang() locale: string,
  ): Promise<AchievementCollectionDto> {
    return this.achievements.getCollection(username, user.id, locale);
  }

  @Get("achievements/unseen")
  getUnseenAchievements(
    @CurrentUser() user: RequestUser,
    @I18nLang() locale: string,
  ): Promise<AchievementCelebrationsDto> {
    return this.achievements.getUnseen(user.id, locale);
  }

  @Post("achievements/celebrated")
  @HttpCode(204)
  async celebrateAchievements(
    @CurrentUser() user: RequestUser,
    @Body() dto: CelebrateAchievementsDto,
  ): Promise<void> {
    await this.achievements.celebrate(user.id, dto.achievementIds);
  }

  /** Effort ranking for a time window (full-page tabs). Unknown `window` → weekly (safe default). */
  @Get("leaderboard")
  @ApiQuery({ name: "window", required: false, enum: ["today", "weekly", "all_time"] })
  getLeaderboard(
    @CurrentUser() user: RequestUser,
    @Query("window") window?: string,
  ): Promise<LeaderboardView> {
    return this.community.getLeaderboard(user.id, toWindow(window));
  }
}
