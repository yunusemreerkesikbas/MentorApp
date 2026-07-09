import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { CommunitySummary, LeaderboardView, PublicProfile } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { CommunityService } from "../application/community.service";
import { toWindow } from "../domain/leaderboard-window";

/**
 * Community right-column effort board. Self-scoped read; the whole payload is about the viewer's
 * own standing, so no feature-flag 404 — economy fields degrade to null when `economy.enabled` is off.
 */
@ApiTags("community")
@ApiBearerAuth()
@Controller("community")
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get("summary")
  getSummary(@CurrentUser() user: RequestUser): Promise<CommunitySummary> {
    return this.community.getSummary(user.id);
  }

  /** Public profile header (identity + gamification) of another user, by username. Unknown → 404. */
  @Get("profile/:username")
  getProfile(@Param("username") username: string): Promise<PublicProfile> {
    return this.community.getPublicProfile(username);
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
