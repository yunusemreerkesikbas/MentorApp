import { HttpStatus, Inject, Injectable, Optional } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { I18nContext } from "nestjs-i18n";
import {
  type AnswerView,
  ModerationTargetType,
  type Paginated,
  type QuestionDetail,
  type ThreadView,
  ZoneRole,
  ZoneType,
} from "@mentor/types";
import type { CreateAnswer, SearchQuery } from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import {
  canAcceptAnswer,
  canDeleteThread,
  canPostInZone,
  type ForumActor,
} from "../domain/forum.policy";
import { ForumEventTopic } from "../domain/forum.events";
import { ForumZoneRepository } from "../infrastructure/forum-zone.repository";
import { ForumThreadRepository, type ThreadWithAuthor } from "../infrastructure/forum-thread.repository";
import { ForumPostRepository } from "../infrastructure/forum-post.repository";
import { ForumAttachmentRepository } from "../infrastructure/forum-attachment.repository";
import { ForumBookmarkRepository } from "../infrastructure/forum-bookmark.repository";
import {
  ForumDiscoveryRepository,
  type ForumTagRow,
} from "../infrastructure/forum-discovery.repository";
import { resolveForumAttachments } from "./attachment.resolve";
import { ForumMentionService } from "./forum-mention.service";
import type { ThreadActor } from "./forum-thread.service";
import { postRowToAnswerView, threadRowToView } from "./forum.mappers";
import { ForumCoachBridgeService } from "./forum-coach-bridge.service";

/**
 * QA behaviour (slice 3): answer / accept / question-detail / search for QA zones. Questions are
 * created via ForumThreadService.postThread (title-enforced). Accept is asker-only + one-shot and
 * emits `forum.answer.accepted` → economy grants XP (no forum→economy coupling). No coin (§4 #3).
 */
@Injectable()
export class ForumQaService {
  constructor(
    private readonly threads: ForumThreadRepository,
    private readonly posts: ForumPostRepository,
    private readonly zones: ForumZoneRepository,
    private readonly attachments: ForumAttachmentRepository,
    private readonly bookmarks: ForumBookmarkRepository,
    private readonly config: ConfigRegistryService,
    private readonly events: EventEmitter2,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly mentions: ForumMentionService,
    @Optional() private readonly discovery?: ForumDiscoveryRepository,
    @Optional() private readonly coachBridge?: ForumCoachBridgeService,
  ) {}

  private async assertEnabled(): Promise<void> {
    if (!(await this.config.get("forum.enabled"))) {
      throw new DomainError(ErrorCode.FORUM_DISABLED, HttpStatus.NOT_FOUND);
    }
  }

  /** Load a QA question visible to the viewer, or throw. Returns the thread + its zone. */
  private async requireQuestion(threadId: string, viewerId: string): Promise<ThreadWithAuthor> {
    const thread = await this.threads.findById(threadId, viewerId);
    if (!thread) throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
    const zone = await this.zones.findById(thread.zoneId, viewerId);
    if (!zone) throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
    if (zone.type !== ZoneType.QA) {
      throw new DomainError(ErrorCode.FORUM_NOT_A_QUESTION, HttpStatus.BAD_REQUEST);
    }
    return thread;
  }

  async answer(actor: ThreadActor, threadId: string, dto: CreateAnswer): Promise<AnswerView> {
    await this.assertEnabled();
    const thread = await this.requireQuestion(threadId, actor.id);
    const membership = await this.zones.findMembership(thread.zoneId, actor.id);
    const forumActor: ForumActor = {
      userId: actor.id,
      platformRoles: actor.roles,
      zoneRole: (membership?.role as ZoneRole | undefined) ?? null,
    };
    if (!canPostInZone(forumActor, ZoneType.QA, membership?.status ?? null)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    // Resolve/validate BEFORE inserting so a bad attachment fails without leaving an answer.
    const toAttach = await resolveForumAttachments(this.storage, actor.id, dto.attachments);
    const post = await this.posts.createAnswer({ threadId, authorId: actor.id, body: dto.body });
    const attached = await this.attachments.insertMany(
      ModerationTargetType.POST,
      post.id,
      actor.id,
      toAttach,
    );
    // Notify the asker that their question got an answer (skip when they answer their own).
    this.events.emit(ForumEventTopic.QUESTION_ANSWERED, {
      threadId,
      recipientId: thread.authorId,
      actorId: actor.id,
    });
    // @mentions in the answer — exclude the asker (already gets the answer notification).
    void this.mentions.dispatch(dto.body, actor.id, `/community/question/${threadId}`, [thread.authorId]);
    // fetch with JOIN so authorName is populated in the immediate response
    const postWithAuthor = await this.posts.findById(post.id, actor.id);
    if (!postWithAuthor) throw new DomainError(ErrorCode.FORUM_POST_NOT_FOUND, HttpStatus.NOT_FOUND);
    return postRowToAnswerView(postWithAuthor, this.storage, attached);
  }

  async accept(actor: ThreadActor, threadId: string, postId: string): Promise<void> {
    await this.assertEnabled();
    const thread = await this.requireQuestion(threadId, actor.id);
    const forumActor: ForumActor = { userId: actor.id, platformRoles: actor.roles, zoneRole: null };
    const post = await this.posts.findById(postId, actor.id);
    if (!post || post.threadId !== threadId) {
      throw new DomainError(ErrorCode.FORUM_POST_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    // Post fetched first so the policy can also reject self-accept (asker accepting their own answer).
    if (!canAcceptAnswer(forumActor, thread.authorId, post.authorId)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    // Atomic one-shot claim: the conditional UPDATE wins exactly once. Concurrent accepts (or a
    // re-accept) get `false` → 409. setAccepted/emit run only for the winner (no double XP grant).
    const claimed = await this.threads.setQaAccepted(threadId, postId);
    if (!claimed) {
      throw new DomainError(ErrorCode.FORUM_ALREADY_ANSWERED, HttpStatus.CONFLICT);
    }
    await this.posts.setAccepted(postId, true);
    // emitAsync: await the XP grant so the answerer's balance reflects the accept by the time we
    // return (the listener is idempotent + flag-guarded). Keeps forum decoupled from economy.
    await this.events.emitAsync(ForumEventTopic.ANSWER_ACCEPTED, {
      threadId,
      postId,
      answerAuthorId: post.authorId,
      askerId: actor.id,
    });
  }

  async getQuestion(viewerId: string, threadId: string): Promise<QuestionDetail> {
    await this.assertEnabled();
    const thread = await this.requireQuestion(threadId, viewerId);
    const [counts, mine, answers] = await Promise.all([
      this.threads.reactionCountsByThread([threadId]),
      this.threads.myReactionsByThread([threadId], viewerId),
      this.posts.listByThread(threadId, viewerId),
    ]);
    // Batched attachment + bookmark lookups (no N+1): the question thread + all answer posts.
    const answerIds = answers.map((a) => a.id);
    const [threadAttach, answerAttach, threadBm, answerBm, tags, threadHelpful, answerHelpful, myThreadHelpful, myAnswerHelpful, coachBridge] = await Promise.all([
      this.attachments.listForTargets(ModerationTargetType.THREAD, [threadId]),
      this.attachments.listForTargets(ModerationTargetType.POST, answerIds),
      this.bookmarks.myBookmarkedTargets(ModerationTargetType.THREAD, [threadId], viewerId),
      this.bookmarks.myBookmarkedTargets(ModerationTargetType.POST, answerIds, viewerId),
      this.discovery?.tagsByThread([threadId], I18nContext.current()?.lang ?? "tr") ??
        Promise.resolve(new Map<string, ForumTagRow[]>()),
      this.discovery?.helpfulCounts(ModerationTargetType.THREAD, [threadId]) ??
        Promise.resolve(new Map()),
      this.discovery?.helpfulCounts(ModerationTargetType.POST, answerIds) ??
        Promise.resolve(new Map()),
      this.discovery?.myHelpfulTargets(ModerationTargetType.THREAD, [threadId], viewerId) ??
        Promise.resolve(new Set()),
      this.discovery?.myHelpfulTargets(ModerationTargetType.POST, answerIds, viewerId) ??
        Promise.resolve(new Set()),
      this.coachBridge?.tryGetBridge(viewerId, threadId, I18nContext.current()?.lang ?? "tr") ??
        Promise.resolve(null),
    ]);
    const lang = (I18nContext.current()?.lang ?? "tr").toLowerCase().startsWith("en") ? "en" : "tr";
    const question = threadRowToView(
      thread,
      counts.get(threadId) ?? {},
      mine.get(threadId) ?? [],
      this.storage,
      answers.length,
      [],
      threadAttach.get(threadId) ?? [],
      threadBm.has(threadId),
    );
    question.tags = (tags.get(threadId) ?? []).map((tag) => ({
      id: tag.id,
      slug: tag.slug,
      name: lang === "en" ? tag.nameEn : tag.nameTr,
      examType: tag.examType,
      isActive: tag.isActive,
    }));
    question.helpfulVoteCount = threadHelpful.get(threadId) ?? 0;
    question.myHelpfulVote = myThreadHelpful.has(threadId);
    question.coachBridge = coachBridge;
    return {
      question,
      answers: answers.map((a) => {
        const answer = postRowToAnswerView(
          a,
          this.storage,
          answerAttach.get(a.id) ?? [],
          answerBm.has(a.id),
        );
        answer.helpfulVoteCount = answerHelpful.get(a.id) ?? 0;
        answer.myHelpfulVote = myAnswerHelpful.has(a.id);
        return answer;
      }),
    };
  }

  async search(viewerId: string, q: SearchQuery): Promise<Paginated<ThreadView>> {
    await this.assertEnabled();
    const { items, total } = await this.threads.searchQuestions(viewerId, {
      q: q.q,
      zoneSlug: q.zone,
      page: q.page,
      pageSize: q.pageSize,
    });
    const ids = items.map((t) => t.id);
    const [counts, mine, commentCounts, bookmarked] = await Promise.all([
      this.threads.reactionCountsByThread(ids),
      this.threads.myReactionsByThread(ids, viewerId),
      this.threads.commentCountsByThread(ids),
      this.bookmarks.myBookmarkedTargets(ModerationTargetType.THREAD, ids, viewerId),
    ]);
    const views = items.map((t) =>
      threadRowToView(
        t,
        counts.get(t.id) ?? {},
        mine.get(t.id) ?? [],
        this.storage,
        commentCounts.get(t.id) ?? 0,
        [],
        [],
        bookmarked.has(t.id),
      ),
    );
    return { items: views, total, page: q.page, pageSize: q.pageSize };
  }

  async removeAnswer(actor: ThreadActor, postId: string): Promise<void> {
    await this.assertEnabled();
    const post = await this.posts.findById(postId, actor.id);
    if (!post) throw new DomainError(ErrorCode.FORUM_POST_NOT_FOUND, HttpStatus.NOT_FOUND);
    const thread = await this.threads.findById(post.threadId, actor.id);
    if (!thread) throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
    const membership = await this.zones.findMembership(thread.zoneId, actor.id);
    const forumActor: ForumActor = {
      userId: actor.id,
      platformRoles: actor.roles,
      zoneRole: (membership?.role as ZoneRole | undefined) ?? null,
    };
    if (!canDeleteThread(forumActor, post.authorId)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    await this.posts.softDelete(postId, actor.id);
  }
}
