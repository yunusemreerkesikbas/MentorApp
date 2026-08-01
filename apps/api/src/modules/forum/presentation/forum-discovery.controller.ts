import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type {
  ForumCoachBridgeView,
  ForumFeed,
  ForumHubView,
  ForumTagView,
  ForumZoneFeedView,
} from "@mentor/types";
import { ModerationTargetType } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { ForumDiscoveryService } from "../application/forum-discovery.service";
import { ForumCoachBridgeService } from "../application/forum-coach-bridge.service";
import {
  FeedQueryDto,
  ForumFeedQueryDto,
  UpdateForumPostDto,
  UpdateForumThreadDto,
} from "./forum.dto";

@ApiTags("forum")
@ApiBearerAuth()
@Controller("forum")
export class ForumDiscoveryController {
  constructor(
    private readonly discovery: ForumDiscoveryService,
    private readonly coachBridge: ForumCoachBridgeService,
  ) {}

  @Get("hub")
  hub(@CurrentUser() user: RequestUser): Promise<ForumHubView> {
    return this.discovery.getHub({ id: user.id, roles: user.roles });
  }

  @Get("feed")
  feed(
    @CurrentUser() user: RequestUser,
    @Query() query: ForumFeedQueryDto,
  ): Promise<ForumFeed> {
    return this.discovery.getFeed({ id: user.id, roles: user.roles }, query);
  }

  @Get("tags")
  tags(@CurrentUser() user: RequestUser): Promise<ForumTagView[]> {
    return this.discovery.listTags(user.id);
  }

  @Get("threads/:threadId/coach-bridge")
  coachBridgeView(
    @CurrentUser() user: RequestUser,
    @Param("threadId", ParseUUIDPipe) threadId: string,
  ): Promise<ForumCoachBridgeView> {
    return this.coachBridge.getBridge(user.id, threadId);
  }

  @Get("zones/:slug/feed")
  zoneFeed(
    @CurrentUser() user: RequestUser,
    @Param("slug") slug: string,
    @Query() query: FeedQueryDto,
  ): Promise<ForumZoneFeedView> {
    return this.discovery.getZoneFeed({ id: user.id, roles: user.roles }, slug, query);
  }

  @Patch("threads/:threadId")
  async updateThread(
    @CurrentUser() user: RequestUser,
    @Param("threadId") threadId: string,
    @Body() body: UpdateForumThreadDto,
  ): Promise<{ status: "ok" }> {
    await this.discovery.updateThread(user.id, threadId, body);
    return { status: "ok" };
  }

  @Patch("posts/:postId")
  async updatePost(
    @CurrentUser() user: RequestUser,
    @Param("postId") postId: string,
    @Body() body: UpdateForumPostDto,
  ): Promise<{ status: "ok" }> {
    await this.discovery.updatePost(user.id, postId, body);
    return { status: "ok" };
  }

  @Put("threads/:threadId/helpful-vote")
  async helpfulThread(
    @CurrentUser() user: RequestUser,
    @Param("threadId") threadId: string,
  ): Promise<{ status: "ok" }> {
    await this.discovery.helpfulVote(user.id, ModerationTargetType.THREAD, threadId, true);
    return { status: "ok" };
  }

  @Delete("threads/:threadId/helpful-vote")
  @HttpCode(204)
  async unhelpfulThread(
    @CurrentUser() user: RequestUser,
    @Param("threadId") threadId: string,
  ): Promise<void> {
    await this.discovery.helpfulVote(user.id, ModerationTargetType.THREAD, threadId, false);
  }

  @Put("posts/:postId/helpful-vote")
  async helpfulPost(
    @CurrentUser() user: RequestUser,
    @Param("postId") postId: string,
  ): Promise<{ status: "ok" }> {
    await this.discovery.helpfulVote(user.id, ModerationTargetType.POST, postId, true);
    return { status: "ok" };
  }

  @Delete("posts/:postId/helpful-vote")
  @HttpCode(204)
  async unhelpfulPost(
    @CurrentUser() user: RequestUser,
    @Param("postId") postId: string,
  ): Promise<void> {
    await this.discovery.helpfulVote(user.id, ModerationTargetType.POST, postId, false);
  }
}
