import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  type CommentDetail,
  type CommentView,
  FORUM_LIKE_EMOJI,
  type ThreadDetail,
  type ThreadFeed,
  type ThreadView,
  ZoneRole,
  ZoneType,
} from "@mentor/types";
import type { CreateAnswer, CreateThread, FeedQuery } from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import {
  canCommentInZone,
  canDeleteThread,
  canPinThread,
  canPostInZone,
  type ForumActor,
} from "../domain/forum.policy";
import { ForumEventTopic } from "../domain/forum.events";
import { ForumZoneRepository } from "../infrastructure/forum-zone.repository";
import { ForumThreadRepository, type ThreadWithAuthor } from "../infrastructure/forum-thread.repository";
import { ForumPostRepository, type PostWithAuthor } from "../infrastructure/forum-post.repository";
import { postRowToCommentView, threadRowToView } from "./forum.mappers";

/** Minimal authenticated principal the controller passes in (id + platform roles). */
export interface ThreadActor {
  id: string;
  roles: string[];
}

/**
 * Forum feed (Slice 2): post/list/pin/delete threads + reactions for CHAT/ANNOUNCEMENT zones.
 * Gated by `forum.enabled`; authz via forum.policy. No XP/economy yet (Slice 3). No coin (§4 #3).
 */
@Injectable()
export class ForumThreadService {
  constructor(
    private readonly threads: ForumThreadRepository,
    private readonly zones: ForumZoneRepository,
    private readonly posts: ForumPostRepository,
    private readonly config: ConfigRegistryService,
    private readonly events: EventEmitter2,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  private async assertEnabled(): Promise<void> {
    if (!(await this.config.get("forum.enabled"))) {
      throw new DomainError(ErrorCode.FORUM_DISABLED, HttpStatus.NOT_FOUND);
    }
  }

  /** Build the actor's two-plane authz view for a zone (their scoped role + status). */
  private async actorFor(
    zoneId: string,
    actor: ThreadActor,
  ): Promise<{ forumActor: ForumActor; memberStatus: string | null }> {
    const membership = await this.zones.findMembership(zoneId, actor.id);
    return {
      forumActor: {
        userId: actor.id,
        platformRoles: actor.roles,
        zoneRole: (membership?.role as ZoneRole | undefined) ?? null,
      },
      memberStatus: membership?.status ?? null,
    };
  }

  async postThread(actor: ThreadActor, zoneId: string, dto: CreateThread): Promise<ThreadView> {
    await this.assertEnabled();
    const zone = await this.zones.findById(zoneId, actor.id);
    if (!zone) throw new DomainError(ErrorCode.FORUM_ZONE_NOT_FOUND, HttpStatus.NOT_FOUND);
    const { forumActor, memberStatus } = await this.actorFor(zoneId, actor);
    if (!canPostInZone(forumActor, zone.type, memberStatus)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    // A QA question needs a title; chat/announcement items must not carry one.
    if (zone.type === ZoneType.QA && !dto.title?.trim()) {
      throw new DomainError(ErrorCode.FORUM_QUESTION_TITLE_REQUIRED, HttpStatus.BAD_REQUEST);
    }
    const title = zone.type === ZoneType.QA ? dto.title : null;
    const row = await this.threads.createThread({ zoneId, authorId: actor.id, body: dto.body, title });
    this.events.emit(ForumEventTopic.THREAD_POSTED, {
      zoneId,
      threadId: row.id,
      authorId: actor.id,
    });
    // fetch with JOIN so authorName is populated in the immediate response
    const rowWithAuthor = await this.threads.findById(row.id, actor.id);
    if (!rowWithAuthor) throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
    return threadRowToView(rowWithAuthor, {}, [], this.storage);
  }

  async listFeed(viewerId: string, zoneId: string, q: FeedQuery): Promise<ThreadFeed> {
    await this.assertEnabled();
    const zone = await this.zones.findById(zoneId, viewerId);
    if (!zone) throw new DomainError(ErrorCode.FORUM_ZONE_NOT_FOUND, HttpStatus.NOT_FOUND);
    const rows =
      q.sort === "popular"
        ? await this.threads.listPopular(viewerId, zoneId, q.limit)
        : await this.threads.listFeed(viewerId, zoneId, { limit: q.limit, before: q.before });
    const ids = rows.map((r) => r.id);
    // Four batched lookups (no N+1).
    const [counts, mine, commentCounts, commenters] = await Promise.all([
      this.threads.reactionCountsByThread(ids),
      this.threads.myReactionsByThread(ids, viewerId),
      this.threads.commentCountsByThread(ids),
      this.threads.recentCommentersByThread(ids),
    ]);
    const items = rows.map((r) =>
      threadRowToView(
        r,
        counts.get(r.id) ?? {},
        mine.get(r.id) ?? [],
        this.storage,
        commentCounts.get(r.id) ?? 0,
        commenters.get(r.id) ?? [],
      ),
    );
    // Popular is a single top-N page (no time cursor). Recent paginates on createdAt.
    // ponytail: heuristic cursor — a full page may have more; worst case one empty trailing fetch.
    const last = items.at(-1);
    const nextCursor =
      q.sort === "popular" ? null : rows.length === q.limit && last ? last.createdAt : null;
    return { items, nextCursor };
  }

  async pin(actor: ThreadActor, threadId: string, pinned: boolean): Promise<void> {
    await this.assertEnabled();
    const thread = await this.requireThread(threadId, actor.id);
    const { forumActor } = await this.actorFor(thread.zoneId, actor);
    if (!canPinThread(forumActor)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    await this.threads.setPinned(threadId, pinned);
  }

  async remove(actor: ThreadActor, threadId: string): Promise<void> {
    await this.assertEnabled();
    const thread = await this.requireThread(threadId, actor.id);
    const { forumActor } = await this.actorFor(thread.zoneId, actor);
    if (!canDeleteThread(forumActor, thread.authorId)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    await this.threads.softDelete(threadId, actor.id);
  }

  async react(userId: string, threadId: string, emoji: string): Promise<void> {
    await this.assertEnabled();
    await this.requireThread(threadId, userId); // visibility belt
    await this.threads.addReaction(threadId, userId, emoji);
  }

  async unreact(userId: string, threadId: string, emoji: string): Promise<void> {
    await this.assertEnabled();
    await this.requireThread(threadId, userId);
    await this.threads.removeReaction(threadId, userId, emoji);
  }

  /** Top-level comment on a CHAT/ANNOUNCEMENT thread (APP-017). QA replies use the answer flow. */
  async comment(actor: ThreadActor, threadId: string, dto: CreateAnswer): Promise<CommentView> {
    await this.assertEnabled();
    const thread = await this.requireThread(threadId, actor.id);
    await this.assertCommentableZone(thread.zoneId, actor);
    const post = await this.posts.createAnswer({ threadId, authorId: actor.id, body: dto.body });
    return this.requireCommentView(post.id, actor.id);
  }

  /** Reply to another comment (nested — Twitter-style). Same zone rules; shares the root thread id. */
  async replyToComment(actor: ThreadActor, postId: string, dto: CreateAnswer): Promise<CommentView> {
    await this.assertEnabled();
    const parent = await this.requirePost(postId, actor.id);
    await this.assertCommentableZone(parent.threadId, actor, /* viaThread */ true);
    const post = await this.posts.createAnswer({
      threadId: parent.threadId,
      authorId: actor.id,
      body: dto.body,
      parentPostId: postId,
    });
    return this.requireCommentView(post.id, actor.id);
  }

  async likePost(userId: string, postId: string): Promise<void> {
    await this.assertEnabled();
    await this.requirePost(postId, userId);
    await this.posts.addPostReaction(postId, userId, FORUM_LIKE_EMOJI);
  }

  async unlikePost(userId: string, postId: string): Promise<void> {
    await this.assertEnabled();
    await this.requirePost(postId, userId);
    await this.posts.removePostReaction(postId, userId, FORUM_LIKE_EMOJI);
  }

  /** A CHAT/ANNOUNCEMENT thread + its top-level comments. QA uses ForumQaService.getQuestion. */
  async getThreadDetail(viewerId: string, threadId: string): Promise<ThreadDetail> {
    await this.assertEnabled();
    const thread = await this.requireThread(threadId, viewerId);
    const [counts, mine, commentCounts, topLevel] = await Promise.all([
      this.threads.reactionCountsByThread([threadId]),
      this.threads.myReactionsByThread([threadId], viewerId),
      this.threads.commentCountsByThread([threadId]),
      this.posts.listTopLevel(threadId, viewerId),
    ]);
    return {
      thread: threadRowToView(
        thread,
        counts.get(threadId) ?? {},
        mine.get(threadId) ?? [],
        this.storage,
        commentCounts.get(threadId) ?? 0,
      ),
      comments: await this.decorateComments(topLevel, viewerId),
    };
  }

  /** A focused comment + its direct replies (recursive navigation entry point). */
  async getCommentDetail(viewerId: string, postId: string): Promise<CommentDetail> {
    await this.assertEnabled();
    const post = await this.requirePost(postId, viewerId);
    const replies = await this.posts.listReplies(postId, viewerId);
    const [[comment], replyViews] = await Promise.all([
      this.decorateComments([post], viewerId),
      this.decorateComments(replies, viewerId),
    ]);
    return { comment: comment!, replies: replyViews };
  }

  /** Fold like/reply counts + the viewer's like state into CommentViews (batched, no N+1). */
  private async decorateComments(
    posts: PostWithAuthor[],
    viewerId: string,
  ): Promise<CommentView[]> {
    const ids = posts.map((p) => p.id);
    const [likeCounts, myLiked, replyCounts] = await Promise.all([
      this.posts.likeCountsByPost(ids),
      this.posts.myLikedPosts(ids, viewerId),
      this.posts.replyCountsByPost(ids),
    ]);
    return posts.map((p) =>
      postRowToCommentView(
        p,
        likeCounts.get(p.id) ?? 0,
        myLiked.has(p.id),
        replyCounts.get(p.id) ?? 0,
        this.storage,
      ),
    );
  }

  private async requireCommentView(postId: string, viewerId: string): Promise<CommentView> {
    const post = await this.posts.findById(postId, viewerId);
    if (!post) throw new DomainError(ErrorCode.FORUM_POST_NOT_FOUND, HttpStatus.NOT_FOUND);
    const [view] = await this.decorateComments([post], viewerId);
    return view!;
  }

  /** Load a visible, non-deleted post (RLS hides deleted) + belt its parent zone visibility. */
  private async requirePost(postId: string, viewerId: string): Promise<PostWithAuthor> {
    const post = await this.posts.findById(postId, viewerId);
    if (!post) throw new DomainError(ErrorCode.FORUM_POST_NOT_FOUND, HttpStatus.NOT_FOUND);
    const thread = await this.threads.findById(post.threadId, viewerId);
    if (!thread) throw new DomainError(ErrorCode.FORUM_POST_NOT_FOUND, HttpStatus.NOT_FOUND);
    return post;
  }

  /** Shared comment-authorization guard: zone exists, is not QA, and the actor may comment. */
  private async assertCommentableZone(
    zoneOrThreadId: string,
    actor: ThreadActor,
    viaThread = false,
  ): Promise<void> {
    const zoneId = viaThread
      ? (await this.threads.findById(zoneOrThreadId, actor.id))?.zoneId
      : zoneOrThreadId;
    const zone = zoneId ? await this.zones.findById(zoneId, actor.id) : null;
    if (!zone) throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
    if (zone.type === ZoneType.QA) {
      throw new DomainError(ErrorCode.FORUM_NOT_A_QUESTION, HttpStatus.BAD_REQUEST);
    }
    const { forumActor, memberStatus } = await this.actorFor(zone.id, actor);
    if (!canCommentInZone(forumActor, zone.type, memberStatus)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
  }

  private async requireThread(threadId: string, viewerId: string): Promise<ThreadWithAuthor> {
    const thread = await this.threads.findById(threadId, viewerId);
    if (!thread) throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
    // Zone-visibility belt: the parent zone must be visible to the viewer (RLS-gated to PUBLIC,
    // non-archived). pin/remove/react fetch the thread directly, so without this the visibility
    // guard that postThread/listFeed get for free would be bypassed once PRIVATE zones land.
    const zone = await this.zones.findById(thread.zoneId, viewerId);
    if (!zone) throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
    return thread;
  }
}
