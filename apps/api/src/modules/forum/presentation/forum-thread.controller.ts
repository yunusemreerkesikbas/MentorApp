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
import type {
  CommentDetail,
  CommentView,
  FollowUserRef,
  ForumActivityFeed,
  ForumAttachmentUploadUrl,
  ReactionUsersPage,
  SavedFeed,
  ThreadDetail,
  ThreadFeed,
  ThreadView,
} from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { ForumThreadService } from "../application/forum-thread.service";
import {
  AttachmentUploadUrlDto,
  BookmarkQueryDto,
  CreateAnswerDto,
  CreateThreadDto,
  FeedQueryDto,
  PinThreadDto,
  ReactionDto,
  ReactionListQueryDto,
} from "./forum.dto";

/**
 * Forum feed (Slice 2): post/list/pin/delete threads + reactions. Reading is open to any authed
 * user (RLS); posting/moderation authz is decided in forum.policy via the service. Flag-gated there.
 */
@ApiTags("forum")
@ApiBearerAuth()
@Controller("forum")
export class ForumThreadController {
  constructor(private readonly threads: ForumThreadService) {}

  /** Presigned upload URL for a post image (client PUTs the file, then sends `key` on create). */
  @Post("attachments/upload-url")
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  attachmentUploadUrl(
    @CurrentUser() user: RequestUser,
    @Body() dto: AttachmentUploadUrlDto,
  ): Promise<ForumAttachmentUploadUrl> {
    return this.threads.createAttachmentUploadUrl(user.id, dto.contentType);
  }

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
    return this.threads.listFeed(user.id, zoneId, q, user.roles);
  }

  /** The viewer's cross-zone "Akış" feed — threads by the people they follow, newest first. */
  @Get("feed/following")
  followingFeed(
    @CurrentUser() user: RequestUser,
    @Query() q: BookmarkQueryDto,
  ): Promise<ThreadFeed> {
    return this.threads.getFollowingFeed(user.id, q.before, user.roles);
  }

  /** "Kimi takip et" — people to follow (active authors in your zones + cohort fallback). */
  @Get("follow-suggestions")
  followSuggestions(@CurrentUser() user: RequestUser): Promise<FollowUserRef[]> {
    return this.threads.getFollowSuggestions(user.id);
  }

  @Get("threads/:threadId/detail")
  detail(
    @CurrentUser() user: RequestUser,
    @Param("threadId") threadId: string,
  ): Promise<ThreadDetail> {
    return this.threads.getThreadDetail(user.id, threadId, user.roles);
  }

  // ponytail: static rate-limit; mirror the thread-post limit until abuse data warrants config.
  @Post("threads/:threadId/comments")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  comment(
    @CurrentUser() user: RequestUser,
    @Param("threadId") threadId: string,
    @Body() dto: CreateAnswerDto,
  ): Promise<CommentView> {
    return this.threads.comment({ id: user.id, roles: user.roles }, threadId, dto);
  }

  @Get("posts/:postId")
  commentDetail(
    @CurrentUser() user: RequestUser,
    @Param("postId") postId: string,
  ): Promise<CommentDetail> {
    return this.threads.getCommentDetail(user.id, postId);
  }

  @Post("posts/:postId/replies")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  reply(
    @CurrentUser() user: RequestUser,
    @Param("postId") postId: string,
    @Body() dto: CreateAnswerDto,
  ): Promise<CommentView> {
    return this.threads.replyToComment({ id: user.id, roles: user.roles }, postId, dto);
  }

  @Put("posts/:postId/reactions")
  async reactPost(
    @CurrentUser() user: RequestUser,
    @Param("postId") postId: string,
    @Body() dto: ReactionDto,
  ): Promise<{ status: string }> {
    await this.threads.reactPost(user.id, postId, dto.emoji);
    return { status: "ok" };
  }

  @Get("posts/:postId/reactions")
  postReactionUsers(
    @CurrentUser() user: RequestUser,
    @Param("postId") postId: string,
    @Query() query: ReactionListQueryDto,
  ): Promise<ReactionUsersPage> {
    return this.threads.listPostReactionUsers(user.id, postId, query);
  }

  @Delete("posts/:postId/reactions")
  @HttpCode(204)
  async unreactPost(
    @CurrentUser() user: RequestUser,
    @Param("postId") postId: string,
    @Body() dto: ReactionDto,
  ): Promise<void> {
    await this.threads.unreactPost(user.id, postId, dto.emoji);
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

  @Get("threads/:threadId/reactions")
  threadReactionUsers(
    @CurrentUser() user: RequestUser,
    @Param("threadId") threadId: string,
    @Query() query: ReactionListQueryDto,
  ): Promise<ReactionUsersPage> {
    return this.threads.listThreadReactionUsers(user.id, threadId, query);
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

  /** The viewer's saved feed (threads + posts interleaved, newest-saved first). */
  @Get("bookmarks")
  bookmarks(@CurrentUser() user: RequestUser, @Query() q: BookmarkQueryDto): Promise<SavedFeed> {
    return this.threads.getMyBookmarks(user.id, q.before, user.roles);
  }

  /** A user's activity feed (their threads + posts interleaved, newest first) for their profile page. */
  @Get("users/:username/activity")
  userActivity(
    @CurrentUser() user: RequestUser,
    @Param("username") username: string,
    @Query() q: BookmarkQueryDto,
  ): Promise<ForumActivityFeed> {
    return this.threads.getUserActivity(user.id, username, q.before, user.roles);
  }

  @Put("threads/:threadId/bookmark")
  async bookmarkThread(
    @CurrentUser() user: RequestUser,
    @Param("threadId") threadId: string,
  ): Promise<{ status: string }> {
    await this.threads.bookmarkThread(user.id, threadId);
    return { status: "ok" };
  }

  @Delete("threads/:threadId/bookmark")
  @HttpCode(204)
  async unbookmarkThread(
    @CurrentUser() user: RequestUser,
    @Param("threadId") threadId: string,
  ): Promise<void> {
    await this.threads.unbookmarkThread(user.id, threadId);
  }

  @Put("posts/:postId/bookmark")
  async bookmarkPost(
    @CurrentUser() user: RequestUser,
    @Param("postId") postId: string,
  ): Promise<{ status: string }> {
    await this.threads.bookmarkPost(user.id, postId);
    return { status: "ok" };
  }

  @Delete("posts/:postId/bookmark")
  @HttpCode(204)
  async unbookmarkPost(
    @CurrentUser() user: RequestUser,
    @Param("postId") postId: string,
  ): Promise<void> {
    await this.threads.unbookmarkPost(user.id, postId);
  }
}
