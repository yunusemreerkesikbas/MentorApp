import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { ThreadFeed, ThreadView } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { ForumThreadService } from "../application/forum-thread.service";
import { CreateThreadDto, FeedQueryDto, PinThreadDto, ReactionDto } from "./forum.dto";

/**
 * Forum feed (Slice 2): post/list/pin/delete threads + reactions. Reading is open to any authed
 * user (RLS); posting/moderation authz is decided in forum.policy via the service. Flag-gated there.
 */
@ApiTags("forum")
@ApiBearerAuth()
@Controller("forum")
export class ForumThreadController {
  constructor(private readonly threads: ForumThreadService) {}

  // ponytail: static rate-limit; make config-driven (forum.post.rate_per_min) once abuse data warrants.
  @Post("zones/:id/threads")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  post(
    @CurrentUser() user: RequestUser,
    @Param("id") zoneId: string,
    @Body() dto: CreateThreadDto,
  ): Promise<ThreadView> {
    return this.threads.postThread({ id: user.id, roles: user.roles }, zoneId, dto);
  }

  @Get("zones/:id/threads")
  feed(
    @CurrentUser() user: RequestUser,
    @Param("id") zoneId: string,
    @Query() q: FeedQueryDto,
  ): Promise<ThreadFeed> {
    return this.threads.listFeed(user.id, zoneId, q);
  }

  @Post("threads/:threadId/pin")
  async pin(
    @CurrentUser() user: RequestUser,
    @Param("threadId") threadId: string,
    @Body() dto: PinThreadDto,
  ): Promise<{ status: string }> {
    await this.threads.pin({ id: user.id, roles: user.roles }, threadId, dto.pinned);
    return { status: "ok" };
  }

  @Delete("threads/:threadId")
  @HttpCode(204)
  async remove(
    @CurrentUser() user: RequestUser,
    @Param("threadId") threadId: string,
  ): Promise<void> {
    await this.threads.remove({ id: user.id, roles: user.roles }, threadId);
  }

  @Put("threads/:threadId/reactions")
  async react(
    @CurrentUser() user: RequestUser,
    @Param("threadId") threadId: string,
    @Body() dto: ReactionDto,
  ): Promise<{ status: string }> {
    await this.threads.react(user.id, threadId, dto.emoji);
    return { status: "ok" };
  }

  @Delete("threads/:threadId/reactions")
  @HttpCode(204)
  async unreact(
    @CurrentUser() user: RequestUser,
    @Param("threadId") threadId: string,
    @Body() dto: ReactionDto,
  ): Promise<void> {
    await this.threads.unreact(user.id, threadId, dto.emoji);
  }
}
