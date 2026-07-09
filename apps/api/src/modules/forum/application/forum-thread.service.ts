import { randomUUID } from "node:crypto";
import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  type CommentDetail,
  type CommentView,
  FORUM_LIKE_EMOJI,
  type ForumAttachmentUploadUrl,
  type ForumActivityFeed,
  type ForumActivityItem,
  ModerationTargetType,
  type SavedFeed,
  type SavedFeedItem,
  type ThreadDetail,
  type ThreadFeed,
  type ThreadView,
  ZoneRole,
  ZoneType,
} from "@mentor/types";
import type { CreateAnswer, CreateThread, FeedQuery } from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError, NotFoundError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { UsersService } from "../../identity/application/users.service";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import {
  extensionForForumImageMime,
  FORUM_ATTACHMENT_ORPHAN_GRACE_MS,
  FORUM_IMAGE_MAX_BYTES,
  FORUM_IMAGE_MIME,
  FORUM_ORPHAN_SWEEP_BATCH,
} from "../domain/attachment.constants";
import { resolveForumAttachments } from "./attachment.resolve";
import { ForumMentionService } from "./forum-mention.service";
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
import { ForumAttachmentRepository } from "../infrastructure/forum-attachment.repository";
import { ForumBookmarkRepository } from "../infrastructure/forum-bookmark.repository";
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
    private readonly attachments: ForumAttachmentRepository,
    private readonly bookmarks: ForumBookmarkRepository,
    private readonly config: ConfigRegistryService,
    private readonly events: EventEmitter2,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly mentions: ForumMentionService,
    private readonly users: UsersService,
  ) {}

  /** Presigned upload URL for a post image (Phase 1). Client PUTs the file, then sends `key` on create. */
  async createAttachmentUploadUrl(
    userId: string,
    contentType: string,
  ): Promise<ForumAttachmentUploadUrl> {
    await this.assertEnabled();
    if (!FORUM_IMAGE_MIME.has(contentType)) {
      throw new DomainError(ErrorCode.FORUM_ATTACHMENT_INVALID, HttpStatus.BAD_REQUEST);
    }
    const ext = extensionForForumImageMime(contentType);
    const result = await this.storage.createUploadUrl({
      key: `forum-attachments/${userId}/${randomUUID()}.${ext}`,
      contentType,
    });
    // Record the minted key as pending; insertMany clears it once attached. A create that never lands
    // leaves the row for the orphan sweep (cleanupOrphanAttachments).
    await this.attachments.markPending(result.key, userId);
    return {
      uploadUrl: result.url,
      key: result.key,
      expiresAt: result.expiresAt,
      maxBytes: FORUM_IMAGE_MAX_BYTES,
    };
  }

  /** Cron sweep: delete storage objects for upload keys minted but never attached past the grace
   * window, then drop their ledger rows. Best-effort per object; bounded per run. */
  async cleanupOrphanAttachments(): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - FORUM_ATTACHMENT_ORPHAN_GRACE_MS);
    const keys = await this.attachments.listExpiredPending(cutoff, FORUM_ORPHAN_SWEEP_BATCH);
    for (const key of keys) {
      await this.storage.deleteObject(key); // best-effort; missing object → no-op
    }
    await this.attachments.deletePending(keys);
    return { deleted: keys.length };
  }

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
    // Resolve/validate BEFORE inserting the thread so a bad attachment fails without leaving a post.
    // QA questions carry images too (Phase 2) — same path as chat/announcement.
    const toAttach = await resolveForumAttachments(this.storage, actor.id, dto.attachments);
    const row = await this.threads.createThread({ zoneId, authorId: actor.id, body: dto.body, title });
    const attached = await this.attachments.insertMany(
      ModerationTargetType.THREAD,
      row.id,
      actor.id,
      toAttach,
    );
    this.events.emit(ForumEventTopic.THREAD_POSTED, {
      zoneId,
      threadId: row.id,
      authorId: actor.id,
    });
    const mentionLink = `/topluluk/${zone.type === ZoneType.QA ? "soru" : "mesaj"}/${row.id}`;
    void this.mentions.dispatch(dto.body, actor.id, mentionLink);
    // fetch with JOIN so authorName is populated in the immediate response
    const rowWithAuthor = await this.threads.findById(row.id, actor.id);
    if (!rowWithAuthor) throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
    return threadRowToView(rowWithAuthor, {}, [], this.storage, 0, [], attached);
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
    // Six batched lookups (no N+1).
    const [counts, mine, commentCounts, commenters, attachMap, bookmarked] = await Promise.all([
      this.threads.reactionCountsByThread(ids),
      this.threads.myReactionsByThread(ids, viewerId),
      this.threads.commentCountsByThread(ids),
      this.threads.recentCommentersByThread(ids),
      this.attachments.listForTargets(ModerationTargetType.THREAD, ids),
      this.bookmarks.myBookmarkedTargets(ModerationTargetType.THREAD, ids, viewerId),
    ]);
    const items = rows.map((r) =>
      threadRowToView(
        r,
        counts.get(r.id) ?? {},
        mine.get(r.id) ?? [],
        this.storage,
        commentCounts.get(r.id) ?? 0,
        commenters.get(r.id) ?? [],
        attachMap.get(r.id) ?? [],
        bookmarked.has(r.id),
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

  async bookmarkThread(userId: string, threadId: string): Promise<void> {
    await this.assertEnabled();
    await this.requireThread(threadId, userId); // visibility belt
    await this.bookmarks.add(userId, ModerationTargetType.THREAD, threadId);
  }

  async unbookmarkThread(userId: string, threadId: string): Promise<void> {
    await this.assertEnabled();
    await this.bookmarks.remove(userId, ModerationTargetType.THREAD, threadId);
  }

  async bookmarkPost(userId: string, postId: string): Promise<void> {
    await this.assertEnabled();
    await this.requirePost(postId, userId); // visibility belt
    await this.bookmarks.add(userId, ModerationTargetType.POST, postId);
  }

  async unbookmarkPost(userId: string, postId: string): Promise<void> {
    await this.assertEnabled();
    await this.bookmarks.remove(userId, ModerationTargetType.POST, postId);
  }

  /**
   * The viewer's saved feed (newest-saved first), threads + posts interleaved. Deleted/hidden targets
   * (RLS-invisible via findManyByIds) silently drop out; the bookmark row is left for a future unsave.
   */
  async getMyBookmarks(viewerId: string, before?: string): Promise<SavedFeed> {
    await this.assertEnabled();
    const limit = 20;
    const rows = await this.bookmarks.listForUser(viewerId, {
      before: before ? new Date(before) : undefined,
      limit,
    });
    const threadIds = rows
      .filter((r) => r.targetType === ModerationTargetType.THREAD)
      .map((r) => r.targetId);
    const postIds = rows
      .filter((r) => r.targetType === ModerationTargetType.POST)
      .map((r) => r.targetId);
    const [threads, posts] = await Promise.all([
      this.threads.findManyByIds(threadIds, viewerId),
      this.posts.findManyByIds(postIds, viewerId),
    ]);
    const threadViews = await this.buildThreadViews(threads, viewerId);
    const postViews = await this.decorateComments(posts, viewerId);
    const threadById = new Map(threadViews.map((t) => [t.id, t]));
    const postById = new Map(postViews.map((p) => [p.id, p]));
    // Preserve the saved order; drop any target that resolved to nothing (deleted/hidden).
    const items = rows.flatMap((r): SavedFeedItem[] => {
      if (r.targetType === ModerationTargetType.THREAD) {
        const thread = threadById.get(r.targetId);
        return thread ? [{ type: "thread", thread }] : [];
      }
      const comment = postById.get(r.targetId);
      return comment ? [{ type: "comment", comment }] : [];
    });
    const nextCursor = rows.length === limit ? rows.at(-1)!.createdAt.toISOString() : null;
    return { items, nextCursor };
  }

  /**
   * A user's forum activity (their threads + posts interleaved, newest first) for their profile page.
   * Viewer state (reactions/bookmarks/likes) is the *viewer's* — so they can interact from the profile.
   * Fetches `limit` from each source and merges: each source's top-N contains all global-top-N candidates.
   */
  async getUserActivity(viewerId: string, username: string, before?: string): Promise<ForumActivityFeed> {
    await this.assertEnabled();
    const user = await this.users.findByUsername(username);
    if (!user) throw new NotFoundError();
    const limit = 20;
    const [threads, posts] = await Promise.all([
      this.threads.listByAuthor(user.id, viewerId, { limit, before }),
      this.posts.listByAuthor(user.id, viewerId, { limit, before }),
    ]);
    const [threadViews, postViews] = await Promise.all([
      this.buildThreadViews(threads, viewerId),
      this.decorateComments(posts, viewerId),
    ]);
    // buildThreadViews/decorateComments preserve input order, so zone[i] pairs with view[i].
    const merged: ForumActivityItem[] = [
      ...threadViews.map((thread, i) => ({
        type: "thread" as const,
        thread,
        zone: { title: threads[i]!.zoneTitle, slug: threads[i]!.zoneSlug },
      })),
      ...postViews.map((comment, i) => ({
        type: "comment" as const,
        comment,
        zone: { title: posts[i]!.zoneTitle, slug: posts[i]!.zoneSlug },
      })),
    ];
    const at = (i: ForumActivityItem) =>
      i.type === "thread" ? i.thread.createdAt : i.comment.createdAt;
    merged.sort((a, b) => at(b).localeCompare(at(a))); // ISO strings sort chronologically
    const items = merged.slice(0, limit);
    // ponytail: heuristic cursor (matches listFeed) — a full page may have more; worst case one empty fetch.
    const nextCursor = items.length === limit ? at(items[items.length - 1]!) : null;
    return { items, nextCursor };
  }

  /** Fold reaction/comment counts + viewer state into ThreadViews for a set of rows (batched). */
  private async buildThreadViews(
    rows: ThreadWithAuthor[],
    viewerId: string,
  ): Promise<ThreadView[]> {
    const ids = rows.map((r) => r.id);
    const [counts, mine, commentCounts, attachMap, bookmarked] = await Promise.all([
      this.threads.reactionCountsByThread(ids),
      this.threads.myReactionsByThread(ids, viewerId),
      this.threads.commentCountsByThread(ids),
      this.attachments.listForTargets(ModerationTargetType.THREAD, ids),
      this.bookmarks.myBookmarkedTargets(ModerationTargetType.THREAD, ids, viewerId),
    ]);
    return rows.map((r) =>
      threadRowToView(
        r,
        counts.get(r.id) ?? {},
        mine.get(r.id) ?? [],
        this.storage,
        commentCounts.get(r.id) ?? 0,
        [],
        attachMap.get(r.id) ?? [],
        bookmarked.has(r.id),
      ),
    );
  }

  /** Top-level comment on a CHAT/ANNOUNCEMENT thread (APP-017). QA replies use the answer flow. */
  async comment(actor: ThreadActor, threadId: string, dto: CreateAnswer): Promise<CommentView> {
    await this.assertEnabled();
    const thread = await this.requireThread(threadId, actor.id);
    await this.assertCommentableZone(thread.zoneId, actor);
    const toAttach = await resolveForumAttachments(this.storage, actor.id, dto.attachments);
    const post = await this.posts.createAnswer({ threadId, authorId: actor.id, body: dto.body });
    await this.attachments.insertMany(ModerationTargetType.POST, post.id, actor.id, toAttach);
    // Notify the thread author about the new comment (self-comment skipped in the listener).
    this.events.emit(ForumEventTopic.THREAD_COMMENTED, {
      threadId,
      recipientId: thread.authorId,
      actorId: actor.id,
    });
    // @mentions in the comment — exclude the thread author (already gets the comment notification).
    void this.mentions.dispatch(dto.body, actor.id, `/topluluk/mesaj/${threadId}`, [thread.authorId]);
    return this.requireCommentView(post.id, actor.id);
  }

  /** Reply to another comment (nested — Twitter-style). Same zone rules; shares the root thread id. */
  async replyToComment(actor: ThreadActor, postId: string, dto: CreateAnswer): Promise<CommentView> {
    await this.assertEnabled();
    const parent = await this.requirePost(postId, actor.id);
    await this.assertCommentableZone(parent.threadId, actor, /* viaThread */ true);
    const toAttach = await resolveForumAttachments(this.storage, actor.id, dto.attachments);
    const post = await this.posts.createAnswer({
      threadId: parent.threadId,
      authorId: actor.id,
      body: dto.body,
      parentPostId: postId,
    });
    await this.attachments.insertMany(ModerationTargetType.POST, post.id, actor.id, toAttach);
    // Notify the parent comment's author about the reply (self-reply skipped in the listener).
    this.events.emit(ForumEventTopic.COMMENT_REPLIED, {
      parentPostId: postId,
      recipientId: parent.authorId,
      actorId: actor.id,
    });
    // @mentions in the reply — exclude the parent author (already gets the reply notification).
    void this.mentions.dispatch(dto.body, actor.id, `/topluluk/yorum/${post.id}`, [parent.authorId]);
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
    const [counts, mine, commentCounts, topLevel, attachMap, bookmarked] = await Promise.all([
      this.threads.reactionCountsByThread([threadId]),
      this.threads.myReactionsByThread([threadId], viewerId),
      this.threads.commentCountsByThread([threadId]),
      this.posts.listTopLevel(threadId, viewerId),
      this.attachments.listForTargets(ModerationTargetType.THREAD, [threadId]),
      this.bookmarks.myBookmarkedTargets(ModerationTargetType.THREAD, [threadId], viewerId),
    ]);
    return {
      thread: threadRowToView(
        thread,
        counts.get(threadId) ?? {},
        mine.get(threadId) ?? [],
        this.storage,
        commentCounts.get(threadId) ?? 0,
        [],
        attachMap.get(threadId) ?? [],
        bookmarked.has(threadId),
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
    const [likeCounts, myLiked, replyCounts, attachMap, bookmarked] = await Promise.all([
      this.posts.likeCountsByPost(ids),
      this.posts.myLikedPosts(ids, viewerId),
      this.posts.replyCountsByPost(ids),
      this.attachments.listForTargets(ModerationTargetType.POST, ids),
      this.bookmarks.myBookmarkedTargets(ModerationTargetType.POST, ids, viewerId),
    ]);
    return posts.map((p) =>
      postRowToCommentView(
        p,
        likeCounts.get(p.id) ?? 0,
        myLiked.has(p.id),
        replyCounts.get(p.id) ?? 0,
        this.storage,
        attachMap.get(p.id) ?? [],
        bookmarked.has(p.id),
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
