import { HttpStatus, Inject, Injectable, Optional } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { I18nContext } from "nestjs-i18n";
import {
  type ForumFeed,
  type ForumFeedItem,
  type ForumFeaturedAdminView,
  type ForumHubView,
  type ForumPublicPerson,
  type ForumSearchView,
  type ForumTagView,
  type ForumTagSuggestionView,
  type ForumTrendsView,
  type ForumThreadSummary,
  type ForumZoneSearchResult,
  type ForumZoneFeedView,
  ModerationTargetType,
  type ZoneRole,
  ZoneType,
} from "@mentor/types";
import type {
  AdminForumTagCreate,
  AdminForumTagUpdate,
  CreateForumTagSuggestion,
  ReviewForumTagSuggestion,
  FeedQuery,
  ForumFeedQuery,
  ForumTrendsQuery,
  SetFeaturedThread,
  UpdateForumPost,
  UpdateForumThread,
} from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import { FollowService } from "../../identity/application/follow.service";
import { UsersService } from "../../identity/application/users.service";
import {
  decodeForumFeedCursor,
  encodeForumFeedCursor,
  evaluateForumEditPolicy,
  mergeHubDiscussionIds,
  normalizeForumTagSlug,
  uniqueForumTagIds,
} from "../domain/forum-discovery.policy";
import { canDeleteThread, canGiveHelpfulVote, isPlatformStaff } from "../domain/forum.policy";
import { ForumAttachmentRepository } from "../infrastructure/forum-attachment.repository";
import { ForumBookmarkRepository } from "../infrastructure/forum-bookmark.repository";
import {
  type DiscoveryThreadRow,
  type DiscoveryWeights,
  ForumDiscoveryRepository,
  type ForumSupporterRow,
  type ForumTagRow,
  type ForumTagSuggestionRow,
  type ForumThreadSummaryRow,
} from "../infrastructure/forum-discovery.repository";
import { ForumPostRepository } from "../infrastructure/forum-post.repository";
import { ForumThreadRepository } from "../infrastructure/forum-thread.repository";
import { ForumZoneRepository } from "../infrastructure/forum-zone.repository";
import { threadRowToView } from "./forum.mappers";
import { ForumService } from "./forum.service";
import { ForumThreadService, type ThreadActor } from "./forum-thread.service";
import { ForumPollService } from "./forum-poll.service";
import { ForumEventTopic, type HelpfulVoteAdded } from "../domain/forum.events";

interface DiscoverySettings {
  trendingWindowHours: number;
  topWindowDays: number;
  editWindowMinutes: number;
  featuredDefaultDays: number;
  weights: DiscoveryWeights;
}

@Injectable()
export class ForumDiscoveryService {
  constructor(
    private readonly repo: ForumDiscoveryRepository,
    private readonly threads: ForumThreadRepository,
    private readonly posts: ForumPostRepository,
    private readonly zones: ForumZoneRepository,
    private readonly attachments: ForumAttachmentRepository,
    private readonly bookmarks: ForumBookmarkRepository,
    private readonly forum: ForumService,
    private readonly threadService: ForumThreadService,
    private readonly users: UsersService,
    private readonly follow: FollowService,
    private readonly config: ConfigRegistryService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Optional() private readonly polls?: ForumPollService,
    @Optional() private readonly events?: EventEmitter2,
  ) {}

  private locale(value?: string): "tr" | "en" {
    const locale = value ?? I18nContext.current()?.lang ?? "tr";
    return locale.toLowerCase().startsWith("en") ? "en" : "tr";
  }

  private async assertEnabled(): Promise<void> {
    if (!(await this.config.get("forum.enabled"))) {
      throw new DomainError(ErrorCode.FORUM_DISABLED, HttpStatus.NOT_FOUND);
    }
  }

  private async settings(): Promise<DiscoverySettings> {
    const [
      trendingWindowHours,
      topWindowDays,
      editWindowMinutes,
      featuredDefaultDays,
      participant,
      reaction,
      bookmark,
      helpful,
      accepted,
      unanswered,
    ] = await Promise.all([
      this.config.get("forum.discovery.trending_window_hours"),
      this.config.get("forum.discovery.top_window_days"),
      this.config.get("forum.discovery.edit_window_minutes"),
      this.config.get("forum.discovery.featured_default_days"),
      this.config.get("forum.discovery.score.participant_weight"),
      this.config.get("forum.discovery.score.reaction_weight"),
      this.config.get("forum.discovery.score.bookmark_weight"),
      this.config.get("forum.discovery.score.helpful_weight"),
      this.config.get("forum.discovery.score.accepted_answer_bonus"),
      this.config.get("forum.discovery.score.unanswered_question_bonus"),
    ]);
    return {
      trendingWindowHours,
      topWindowDays,
      editWindowMinutes,
      featuredDefaultDays,
      weights: { participant, reaction, bookmark, helpful, accepted, unanswered },
    };
  }

  async getFeed(
    actor: ThreadActor,
    query: ForumFeedQuery,
    locale?: string,
  ): Promise<ForumFeed> {
    await this.assertEnabled();
    const cursor = query.cursor ? decodeForumFeedCursor(query.cursor) : undefined;
    if (query.cursor && (!cursor || cursor.sort !== query.sort)) {
      throw new DomainError(ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST);
    }
    const [profile, settings, authorIds] = await Promise.all([
      this.users.getDiscoveryProfile(actor.id),
      this.settings(),
      query.scope === "following" ? this.follow.getFolloweeIds(actor.id) : Promise.resolve(undefined),
    ]);
    const rows = await this.repo.listDiscoveryThreads({
      viewerId: actor.id,
      examType: profile.examType,
      authorIds,
      sort: query.sort,
      tag: query.tag,
      zoneType: query.contentType === "questions" ? ZoneType.QA : query.contentType ? undefined : query.zoneType,
      zoneTypes: query.contentType === "posts" ? [ZoneType.CHAT, ZoneType.ANNOUNCEMENT] : undefined,
      cursor: cursor ?? undefined,
      limit: query.limit + 1,
      trendingWindowHours: settings.trendingWindowHours,
      topWindowDays: settings.topWindowDays,
      weights: settings.weights,
    });
    const hasMore = rows.length > query.limit;
    const visibleRows = rows.slice(0, query.limit);
    const items = await this.decorateThreads(visibleRows, actor, this.locale(locale), settings);
    const last = hasMore ? visibleRows.at(-1) : undefined;
    const nextCursor = last
      ? encodeForumFeedCursor({
          sort: query.sort,
          score: last.score,
          createdAt: last.createdAt.toISOString(),
          lastActivityAt: last.lastActivityAt.toISOString(),
          id: last.id,
        })
      : null;
    const summaries = visibleRows.map((row) => this.toSummary(row));
    return {
      items,
      nextCursor,
      context: {
        activeThreads: [...summaries]
          .sort((left, right) => right.commentCount - left.commentCount)
          .slice(0, 3),
        suggestedThreads: summaries.slice(3, 6),
      },
    };
  }

  /** Backward-compatible adapter for the old `/feed/following` endpoint. */
  getFollowingFeed(
    actor: ThreadActor,
    query: { before?: string; limit?: number },
    locale?: string,
  ): Promise<ForumFeed> {
    return this.getFeed(
      actor,
      {
        scope: "following",
        sort: "recent",
        limit: query.limit ?? 20,
        ...(query.before ? { cursor: query.before } : {}),
      },
      locale,
    );
  }

  async getHub(actor: ThreadActor, locale?: string): Promise<ForumHubView> {
    await this.assertEnabled();
    const lang = this.locale(locale);
    const [profile, settings] = await Promise.all([
      this.users.getDiscoveryProfile(actor.id),
      this.settings(),
    ]);
    const common = {
      viewerId: actor.id,
      examType: profile.examType,
      limit: 8,
      trendingWindowHours: settings.trendingWindowHours,
      topWindowDays: settings.topWindowDays,
      weights: settings.weights,
    } as const;
    const [manualFeatured, fallbackFeatured, interactedIds, relevantRows, trendingTags, supporters, zoneIds] =
      await Promise.all([
        this.repo.listDiscoveryThreads({
          ...common,
          sort: "trending",
          featuredOnly: true,
          limit: 1,
        }),
        this.repo.listDiscoveryThreads({
          ...common,
          sort: "trending",
          zoneTypes: [ZoneType.CHAT, ZoneType.QA],
          requireReplies: true,
          trendingWindowHours: 7 * 24,
          limit: 1,
        }),
        this.repo.recentInteractionThreadIds(actor.id, 8),
        this.repo.listDiscoveryThreads({ ...common, sort: "recent" }),
        this.repo.trendingTags(lang, profile.examType, 6, "relevant", settings.trendingWindowHours),
        this.repo.weeklySupporters(profile.examType, 6),
        this.repo.recommendedZoneIds(actor.id, profile.examType, 3),
      ]);
    const selectedFeatured = manualFeatured[0] ?? fallbackFeatured[0] ?? relevantRows[0] ?? null;
    const continueIds = mergeHubDiscussionIds(
      interactedIds,
      relevantRows
        .filter((row) => row.id !== selectedFeatured?.id)
        .map((row) => row.id),
    );
    const continueRows = await this.repo.listDiscoveryThreads({
      ...common,
      sort: "recent",
      threadIds: continueIds,
      limit: continueIds.length,
    });
    const continueById = new Map(continueRows.map((row) => [row.id, row]));
    const orderedContinueRows = continueIds.flatMap((id) => {
      const row = continueById.get(id);
      return row ? [row] : [];
    });
    const [featuredItems, continueDiscussions, zones] = await Promise.all([
      selectedFeatured
        ? this.decorateThreads([selectedFeatured], actor, lang, settings)
        : Promise.resolve([]),
      this.decorateThreads(orderedContinueRows, actor, lang, settings),
      this.forum.listZones(actor.id, actor.roles, { page: 1, pageSize: 100 }),
    ]);
    const zoneById = new Map(zones.items.map((zone) => [zone.id, zone]));
    return {
      featured: featuredItems[0] ?? null,
      continueDiscussions,
      trendingTags: trendingTags.map(({ tag, threadCount }) => ({
        ...this.toTagView(tag, lang),
        threadCount,
      })),
      supporters: supporters.map((row) => this.toPerson(row)),
      recommendedZones: zoneIds.flatMap((id) => {
        const zone = zoneById.get(id);
        return zone ? [zone] : [];
      }),
    };
  }

  async getTrends(
    actor: ThreadActor,
    query: ForumTrendsQuery,
    locale?: string,
  ): Promise<ForumTrendsView> {
    await this.assertEnabled();
    const [profile, settings] = await Promise.all([
      this.users.getDiscoveryProfile(actor.id),
      this.settings(),
    ]);
    const lang = this.locale(locale);
    const rows = await this.repo.trendingTags(
      lang,
      profile.examType,
      query.limit,
      query.scope,
      settings.trendingWindowHours,
    );
    return {
      items: rows.map(({ tag, threadCount }) => ({
        ...this.toTagView(tag, lang),
        threadCount,
      })),
      scope: query.scope,
      examType: profile.examType,
      windowHours: settings.trendingWindowHours,
    };
  }

  async search(viewerId: string, q: string, locale?: string): Promise<ForumSearchView> {
    await this.assertEnabled();
    const lang = this.locale(locale);
    const [threads, questions, zones, tags, people] = await Promise.all([
      this.repo.searchThreadSummaries(q, 5),
      this.repo.searchThreadSummaries(q, 5, ZoneType.QA),
      this.repo.searchZones(q, 5),
      this.repo.searchTags(q, 5),
      this.users.searchPublicUsers(q, 5),
    ]);
    return {
      threads: threads.map((row) => this.toSummary(row)),
      questions: questions.map((row) => this.toSummary(row)),
      zones: zones.map(
        (zone): ForumZoneSearchResult => ({
          ...zone,
          type: zone.type as ZoneType,
        }),
      ),
      tags: tags.map((row) => this.toTagView(row, lang)),
      people,
    };
  }

  async listTags(_viewerId: string, locale?: string): Promise<ForumTagView[]> {
    await this.assertEnabled();
    const lang = this.locale(locale);
    const tags = await this.repo.listTags(lang);
    return tags.map((tag) => this.toTagView(tag, lang));
  }

  async getZoneFeed(
    actor: ThreadActor,
    slug: string,
    query: FeedQuery,
  ): Promise<ForumZoneFeedView> {
    await this.assertEnabled();
    const zone = await this.forum.getZone(actor.id, actor.roles, slug);
    const [feed, contributors, pinned] = await Promise.all([
      this.threadService.listFeed(actor.id, zone.id, query, actor.roles),
      this.repo.zoneContributors(zone.id, 6),
      this.repo.pinnedThreadSummaries(zone.id, 4),
    ]);
    return {
      zone,
      feed,
      contributors: contributors.map((row) => this.toPerson(row)),
      pinnedThreads: pinned.map((row) => this.toSummary(row)),
    };
  }

  async helpfulVote(
    viewerId: string,
    targetType: ModerationTargetType,
    targetId: string,
    selected: boolean,
  ): Promise<void> {
    await this.assertEnabled();
    let recipientId: string;
    if (targetType === ModerationTargetType.THREAD) {
      const thread = await this.threads.findById(targetId, viewerId);
      if (!thread) throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
      const zone = await this.zones.findById(thread.zoneId, viewerId);
      if (!zone || zone.type !== ZoneType.QA) {
        throw new DomainError(ErrorCode.FORUM_NOT_A_QUESTION, HttpStatus.BAD_REQUEST);
      }
      if (!canGiveHelpfulVote(viewerId, thread.authorId)) {
        throw new DomainError(ErrorCode.FORUM_HELPFUL_VOTE_SELF, HttpStatus.BAD_REQUEST);
      }
      recipientId = thread.authorId;
    } else {
      const post = await this.posts.findById(targetId, viewerId);
      if (!post) throw new DomainError(ErrorCode.FORUM_POST_NOT_FOUND, HttpStatus.NOT_FOUND);
      const thread = await this.threads.findById(post.threadId, viewerId);
      const zone = thread ? await this.zones.findById(thread.zoneId, viewerId) : null;
      if (!thread || !zone || zone.type !== ZoneType.QA) {
        throw new DomainError(ErrorCode.FORUM_NOT_A_QUESTION, HttpStatus.BAD_REQUEST);
      }
      if (!canGiveHelpfulVote(viewerId, post.authorId)) {
        throw new DomainError(ErrorCode.FORUM_HELPFUL_VOTE_SELF, HttpStatus.BAD_REQUEST);
      }
      recipientId = post.authorId;
    }
    if (selected) {
      const inserted = await this.repo.addHelpfulVote(targetType, targetId, viewerId);
      if (inserted) {
        const event: HelpfulVoteAdded = { recipientId, actorId: viewerId, targetId };
        this.events?.emit(ForumEventTopic.HELPFUL_VOTE_ADDED, event);
      }
    } else {
      await this.repo.removeHelpfulVote(targetType, targetId, viewerId);
    }
  }

  async updateThread(
    viewerId: string,
    threadId: string,
    patch: UpdateForumThread,
  ): Promise<void> {
    await this.assertEnabled();
    const thread = await this.threads.findById(threadId, viewerId);
    if (!thread) throw new DomainError(ErrorCode.FORUM_THREAD_NOT_FOUND, HttpStatus.NOT_FOUND);
    const [editWindowMinutes, interactionCount] = await Promise.all([
      this.config.get("forum.discovery.edit_window_minutes"),
      this.repo.interactionCount(ModerationTargetType.THREAD, threadId),
    ]);
    this.assertEditable({
      viewerId,
      authorId: thread.authorId,
      createdAt: thread.createdAt,
      editWindowMinutes,
      interactionCount,
    });
    const tagIds = patch.tagIds ? uniqueForumTagIds(patch.tagIds) : undefined;
    if (tagIds) await this.assertActiveTags(tagIds);
    const textPatch = {
      ...(patch.body !== undefined && { body: patch.body }),
      ...(patch.title !== undefined && { title: patch.title }),
    };
    if (Object.keys(textPatch).length > 0) await this.repo.updateThread(threadId, textPatch);
    if (tagIds) await this.repo.replaceThreadTags(threadId, tagIds);
  }

  async updatePost(viewerId: string, postId: string, patch: UpdateForumPost): Promise<void> {
    await this.assertEnabled();
    const post = await this.posts.findById(postId, viewerId);
    if (!post) throw new DomainError(ErrorCode.FORUM_POST_NOT_FOUND, HttpStatus.NOT_FOUND);
    const [editWindowMinutes, interactionCount] = await Promise.all([
      this.config.get("forum.discovery.edit_window_minutes"),
      this.repo.interactionCount(ModerationTargetType.POST, postId),
    ]);
    this.assertEditable({
      viewerId,
      authorId: post.authorId,
      createdAt: post.createdAt,
      editWindowMinutes,
      interactionCount,
    });
    await this.repo.updatePost(postId, patch.body);
  }

  async validateTags(tagIds: string[] | undefined): Promise<string[]> {
    const unique = uniqueForumTagIds(tagIds ?? []);
    await this.assertActiveTags(unique);
    return unique;
  }

  async createTagSuggestion(
    viewerId: string,
    input: CreateForumTagSuggestion,
  ): Promise<ForumTagSuggestionView> {
    await this.assertEnabled();
    const normalizedSlug = normalizeForumTagSlug(input.name);
    if (normalizedSlug.length < 2) {
      throw new DomainError(ErrorCode.FORUM_TAG_SUGGESTION_INVALID, HttpStatus.BAD_REQUEST);
    }
    const row = await this.repo.createTagSuggestion(viewerId, input.name, normalizedSlug);
    if (!row) {
      throw new DomainError(ErrorCode.FORUM_TAG_SUGGESTION_EXISTS, HttpStatus.CONFLICT);
    }
    return this.toTagSuggestionView(row);
  }

  async listAdminTagSuggestions(): Promise<ForumTagSuggestionView[]> {
    const rows = await this.repo.listTagSuggestions();
    return rows.map((row) => this.toTagSuggestionView(row));
  }

  async reviewAdminTagSuggestion(
    actorId: string,
    suggestionId: string,
    input: ReviewForumTagSuggestion,
  ): Promise<ForumTagSuggestionView> {
    const result = await this.repo.resolveTagSuggestion(actorId, suggestionId, input);
    if (result.kind === "NOT_FOUND") {
      throw new DomainError(ErrorCode.FORUM_TAG_SUGGESTION_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (result.kind !== "OK") {
      throw new DomainError(ErrorCode.FORUM_TAG_SUGGESTION_RESOLVED, HttpStatus.CONFLICT);
    }
    return this.toTagSuggestionView(result.row);
  }

  async listAdminTags(): Promise<ForumTagView[]> {
    const rows = await this.repo.listAllTags();
    return rows.map((row) => this.toTagView(row, "tr", true));
  }

  async createAdminTag(actorId: string, input: AdminForumTagCreate): Promise<ForumTagView> {
    const row = await this.repo.upsertTag(actorId, input);
    return this.toTagView(row, "tr", true);
  }

  async updateAdminTag(
    actorId: string,
    tagId: string,
    input: AdminForumTagUpdate,
  ): Promise<ForumTagView> {
    const row = await this.repo.upsertTag(actorId, { id: tagId, ...input });
    if (!row) throw new DomainError(ErrorCode.FORUM_TAG_INVALID, HttpStatus.NOT_FOUND);
    return this.toTagView(row, "tr", true);
  }

  async getAdminFeatured(): Promise<ForumFeaturedAdminView | null> {
    const row = await this.repo.getFeaturedThread();
    return row
      ? {
          threadId: row.id,
          featuredUntil: row.featuredUntil.toISOString(),
          featuredBy: row.featuredBy,
          thread: this.toSummary(row),
        }
      : null;
  }

  async setAdminFeatured(
    actorId: string,
    input: SetFeaturedThread,
  ): Promise<ForumFeaturedAdminView> {
    const settings = await this.settings();
    const thread = await this.threads.findByIdIncludingDeleted(input.threadId);
    if (!thread || thread.deletedAt) {
      throw new DomainError(ErrorCode.FORUM_FEATURED_INVALID, HttpStatus.CONFLICT);
    }
    const until = input.featuredUntil
      ? new Date(input.featuredUntil)
      : new Date(Date.now() + settings.featuredDefaultDays * 86_400_000);
    if (until.getTime() <= Date.now()) {
      throw new DomainError(ErrorCode.FORUM_FEATURED_INVALID, HttpStatus.CONFLICT);
    }
    await this.repo.setFeaturedThread(thread.id, actorId, until);
    const featured = await this.getAdminFeatured();
    if (!featured || featured.threadId !== thread.id) {
      throw new DomainError(ErrorCode.FORUM_FEATURED_INVALID, HttpStatus.CONFLICT);
    }
    return featured;
  }

  clearAdminFeatured(): Promise<void> {
    return this.repo.clearFeaturedThread();
  }

  private assertEditable(input: {
    viewerId: string;
    authorId: string;
    createdAt: Date;
    editWindowMinutes: number;
    interactionCount: number;
  }): void {
    const policy = evaluateForumEditPolicy({ ...input, now: new Date() });
    if (policy.allowed) return;
    if (policy.reason === "FORBIDDEN") {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    throw new DomainError(
      policy.reason === "EXPIRED" ? ErrorCode.FORUM_EDIT_EXPIRED : ErrorCode.FORUM_EDIT_LOCKED,
      HttpStatus.CONFLICT,
    );
  }

  private async assertActiveTags(tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;
    if ((await this.repo.activeTagCount(tagIds)) !== tagIds.length) {
      throw new DomainError(ErrorCode.FORUM_TAG_INVALID, HttpStatus.BAD_REQUEST);
    }
  }

  private async decorateThreads(
    rows: DiscoveryThreadRow[],
    actor: ThreadActor,
    locale: "tr" | "en",
    settings: DiscoverySettings,
  ): Promise<ForumFeedItem[]> {
    const ids = rows.map((row) => row.id);
    const zoneIds = [...new Set(rows.map((row) => row.zoneId))];
    const [tags, reactionCounts, myReactions, attachMap, bookmarked, myHelpful, memberships, pollViews] =
      await Promise.all([
        this.repo.tagsByThread(ids, locale),
        this.threads.reactionCountsByThread(ids),
        this.threads.myReactionsByThread(ids, actor.id),
        this.attachments.listForTargets(ModerationTargetType.THREAD, ids),
        this.bookmarks.myBookmarkedTargets(ModerationTargetType.THREAD, ids, actor.id),
        this.repo.myHelpfulTargets(ModerationTargetType.THREAD, ids, actor.id),
        this.zones.findMembershipsByZone(zoneIds, actor.id),
        this.polls?.viewsForThreads(ids, actor.id) ?? Promise.resolve(new Map()),
      ]);
    return rows.map((row) => {
      const membership = memberships.get(row.zoneId);
      const forumActor = {
        userId: actor.id,
        platformRoles: actor.roles,
        zoneRole: (membership?.role as ZoneRole | undefined) ?? null,
      };
      const edit = evaluateForumEditPolicy({
        viewerId: actor.id,
        authorId: row.authorId,
        createdAt: row.createdAt,
        now: new Date(),
        editWindowMinutes: settings.editWindowMinutes,
        interactionCount:
          row.commentCount +
          row.reactionCount +
          row.helpfulVoteCount +
          (row.acceptedPostId ? 1 : 0) +
          (pollViews.get(row.id)?.totalVoteCount ?? 0),
      });
      const legacy = threadRowToView(
        row,
        reactionCounts.get(row.id) ?? {},
        myReactions.get(row.id) ?? [],
        this.storage,
        row.commentCount,
        [],
        attachMap.get(row.id) ?? [],
        bookmarked.has(row.id),
      );
      return {
        id: row.id,
        zone: {
          id: row.zoneId,
          title: row.zoneTitle,
          slug: row.zoneSlug,
          type: row.zoneType as ZoneType,
        },
        author: {
          id: row.authorId,
          displayName: row.authorName,
          username: row.authorUsername ?? "",
          avatarUrl: row.authorAvatarStorageKey
            ? this.storage.getPublicUrl(row.authorAvatarStorageKey)
            : null,
        },
        title: row.title,
        body: row.body,
        poll: pollViews.get(row.id) ?? null,
        status: legacy.status,
        acceptedPostId: row.acceptedPostId,
        isPinned: row.isPinned,
        tags: (tags.get(row.id) ?? []).map((tag) => this.toTagView(tag, locale)),
        reactionCounts: legacy.reactionCounts,
        myReactions: legacy.myReactions,
        helpfulVoteCount: row.helpfulVoteCount,
        myHelpfulVote: myHelpful.has(row.id),
        canHelpfulVote: canGiveHelpfulVote(actor.id, row.authorId),
        commentCount: row.commentCount,
        attachments: legacy.attachments,
        myBookmarked: legacy.myBookmarked,
        capabilities: {
          canEdit: edit.allowed,
          canDelete: canDeleteThread(forumActor, row.authorId),
          canModerate: isPlatformStaff(actor.roles) || Boolean(membership?.role === "OWNER" || membership?.role === "MODERATOR"),
          editDeadline: row.authorId === actor.id ? edit.deadline.toISOString() : null,
        },
        createdAt: row.createdAt.toISOString(),
        lastActivityAt: row.lastActivityAt.toISOString(),
        editedAt: row.editedAt?.toISOString() ?? null,
        score: row.score,
      };
    });
  }

  private toTagView(tag: ForumTagRow, locale: "tr" | "en", admin = false): ForumTagView {
    return {
      id: tag.id,
      slug: tag.slug,
      name: locale === "en" ? tag.nameEn : tag.nameTr,
      ...(admin && { nameTr: tag.nameTr, nameEn: tag.nameEn }),
      examType: tag.examType,
      isActive: tag.isActive,
      ...(admin && { coachIntent: tag.coachIntent }),
      ...(admin && {
        createdAt: tag.createdAt.toISOString(),
        updatedAt: tag.updatedAt.toISOString(),
      }),
    };
  }

  private toTagSuggestionView(row: ForumTagSuggestionRow): ForumTagSuggestionView {
    return {
      id: row.id,
      requestedName: row.requestedName,
      normalizedSlug: row.normalizedSlug,
      status: row.status as ForumTagSuggestionView["status"],
      resolvedTagId: row.resolvedTagId,
      createdAt: row.createdAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    };
  }

  private toPerson(row: ForumSupporterRow): ForumPublicPerson {
    return {
      id: row.id,
      displayName: row.displayName,
      username: row.username,
      avatarUrl: row.avatarStorageKey ? this.storage.getPublicUrl(row.avatarStorageKey) : null,
    };
  }

  private toSummary(row: ForumThreadSummaryRow | DiscoveryThreadRow): ForumThreadSummary {
    return {
      id: row.id,
      zoneSlug: row.zoneSlug,
      zoneTitle: row.zoneTitle,
      zoneType: row.zoneType as ZoneType,
      title: row.title,
      bodyExcerpt: row.body.length > 180 ? `${row.body.slice(0, 177)}…` : row.body,
      commentCount: Number(row.commentCount),
      lastActivityAt: row.lastActivityAt.toISOString(),
    };
  }
}
