import { Controller, Delete, Get, HttpCode, Param, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FollowList } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { FollowService } from "../application/follow.service";
import { FollowListQueryDto } from "./follow.dto";

/** Social follow graph (authenticated — global JwtAuthGuard applies). Routes under /v1/users/:username. */
@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class FollowController {
  constructor(private readonly follow: FollowService) {}

  @Put(":username/follow")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async followUser(
    @CurrentUser() user: RequestUser,
    @Param("username") username: string,
  ): Promise<{ status: string }> {
    await this.follow.follow(user.id, username);
    return { status: "ok" };
  }

  @Delete(":username/follow")
  @HttpCode(204)
  async unfollowUser(
    @CurrentUser() user: RequestUser,
    @Param("username") username: string,
  ): Promise<void> {
    await this.follow.unfollow(user.id, username);
  }

  @Get(":username/followers")
  followers(
    @CurrentUser() user: RequestUser,
    @Param("username") username: string,
    @Query() q: FollowListQueryDto,
  ): Promise<FollowList> {
    return this.follow.getFollowers(username, user.id, q.before);
  }

  @Get(":username/following")
  following(
    @CurrentUser() user: RequestUser,
    @Param("username") username: string,
    @Query() q: FollowListQueryDto,
  ): Promise<FollowList> {
    return this.follow.getFollowing(username, user.id, q.before);
  }
}
