import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import type { ForumFeedSort, ModerationTargetType, ZoneType } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import {
  forumBookmarks,
  forumHelpfulVotes,
  forumPostReactions,
  forumPosts,
  forumReactions,
  forumTags,
  forumThreadTags,
  forumThreads,
  forumZoneMembers,
  forumZones,
  users,
} from "../../../database/schema";
import type { ForumFeedCursor } from "../domain/forum-discovery.policy";

export type ForumTagRow = typeof forumTags.$inferSelect;

export interface DiscoveryWeights {
  participant: number;
  reaction: number;
  bookmark: number;
  helpful: number;
  accepted: number;
}

export type DiscoveryThreadRow = typeof forumThreads.$inferSelect & {
  zoneTitle: string;
  zoneSlug: string;
  zoneType: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatarStorageKey: string | null;
  reactionCount: number;
  helpfulVoteCount: number;
  commentCount: number;
  score: number;
};

export interface ForumSupporterRow {
  id: string;
  displayName: string;
  username: string;
  avatarStorageKey: string | null;
}

export interface ForumThreadSummaryRow {
  id: string;
  zoneSlug: string;
  zoneTitle: string;
  zoneType: string;
  title: string | null;
  body: string;
  commentCount: number;
  lastActivityAt: Date;
}

export interface ForumFeaturedThreadRow extends ForumThreadSummaryRow {
  featuredUntil: Date;
  featuredBy: string | null;
}

@Injectable()
export class ForumDiscoveryRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listDiscoveryThreads(opts: {
    viewerId: string;
    examType: string | null;
    authorIds?: string[];
    threadIds?: string[];
    sort: ForumFeedSort;
    tag?: string;
    zoneType?: ZoneType;
    zoneTypes?: ZoneType[];
    cursor?: ForumFeedCursor;
    limit: number;
    trendingWindowHours: number;
    topWindowDays: number;
    weights: DiscoveryWeights;
    requireReplies?: boolean;
    featuredOnly?: boolean;
  }): Promise<DiscoveryThreadRow[]> {
    if (opts.authorIds && opts.authorIds.length === 0) return [];
    if (opts.threadIds && opts.threadIds.length === 0) return [];

    return withServiceContext(this.db, async (tx) => {
      const reactionCount = sql<number>`(
        (select count(*) from ${forumReactions} fr where fr.thread_id = ${forumThreads.id})
        + (select count(*) from ${forumPostReactions} fpr
           inner join ${forumPosts} fp on fp.id = fpr.post_id
           where fp.thread_id = ${forumThreads.id} and fp.deleted_at is null)
      )::int`;
      const helpfulVoteCount = sql<number>`(
        (select count(*) from ${forumHelpfulVotes} fhv
           where fhv.target_type = 'THREAD' and fhv.target_id = ${forumThreads.id})
        + (select count(*) from ${forumHelpfulVotes} fhv
           inner join ${forumPosts} fp on fp.id = fhv.target_id
           where fhv.target_type = 'POST' and fp.thread_id = ${forumThreads.id}
             and fp.deleted_at is null)
      )::int`;
      const bookmarkCount = sql<number>`(
        (select count(*) from ${forumBookmarks} fb
           where fb.target_type = 'THREAD' and fb.target_id = ${forumThreads.id})
        + (select count(*) from ${forumBookmarks} fb
           inner join ${forumPosts} fp on fp.id = fb.target_id
           where fb.target_type = 'POST' and fp.thread_id = ${forumThreads.id}
             and fp.deleted_at is null)
      )::int`;
      const commentCount = sql<number>`(
        select count(*) from ${forumPosts} fp
        where fp.thread_id = ${forumThreads.id} and fp.deleted_at is null
      )::int`;
      const participantCount = sql<number>`(
        select count(distinct participant_id) from (
          select fp.author_id as participant_id
          from ${forumPosts} fp
          where fp.thread_id = ${forumThreads.id} and fp.deleted_at is null
          union
          select fr.user_id as participant_id
          from ${forumReactions} fr
          where fr.thread_id = ${forumThreads.id}
        ) forum_participants
      )::int`;
      const score = sql<number>`(
        (${participantCount} * ${opts.weights.participant})
        + (${reactionCount} * ${opts.weights.reaction})
        + (${bookmarkCount} * ${opts.weights.bookmark})
        + (${helpfulVoteCount} * ${opts.weights.helpful})
        + (case when ${forumThreads.acceptedPostId} is not null then ${opts.weights.accepted} else 0 end)
      )::int`;

      const conditions = [
        isNull(forumThreads.deletedAt),
        eq(forumZones.visibility, "PUBLIC"),
        eq(forumZones.isArchived, false),
      ];
      if (opts.examType) {
        conditions.push(or(isNull(forumZones.examType), eq(forumZones.examType, opts.examType))!);
      }
      if (opts.authorIds) conditions.push(inArray(forumThreads.authorId, opts.authorIds));
      if (opts.threadIds) conditions.push(inArray(forumThreads.id, opts.threadIds));
      if (opts.zoneType) conditions.push(eq(forumZones.type, opts.zoneType));
      if (opts.zoneTypes) conditions.push(inArray(forumZones.type, opts.zoneTypes));
      if (opts.requireReplies) conditions.push(sql`${commentCount} > 0`);
      if (opts.featuredOnly) conditions.push(sql`${forumThreads.featuredUntil} > now()`);
      if (opts.tag) {
        conditions.push(sql`exists (
          select 1 from ${forumThreadTags} ftt
          inner join ${forumTags} ft on ft.id = ftt.tag_id
          where ftt.thread_id = ${forumThreads.id}
            and ft.slug = ${opts.tag}
            and ft.is_active = true
        )`);
      }
      if (opts.sort === "trending") {
        conditions.push(
          sql`${forumThreads.lastActivityAt} >= now() - (${opts.trendingWindowHours} * interval '1 hour')`,
        );
      }
      if (opts.sort === "top") {
        conditions.push(
          sql`${forumThreads.lastActivityAt} >= now() - (${opts.topWindowDays} * interval '1 day')`,
        );
      }
      if (opts.cursor) {
        const cursor = opts.cursor;
        if (opts.sort === "recent") {
          conditions.push(sql`(
            ${forumThreads.createdAt} < ${new Date(cursor.createdAt)}
            or (
              ${forumThreads.createdAt} = ${new Date(cursor.createdAt)}
              and ${forumThreads.lastActivityAt} < ${new Date(cursor.lastActivityAt)}
            )
            or (
              ${forumThreads.createdAt} = ${new Date(cursor.createdAt)}
              and ${forumThreads.lastActivityAt} = ${new Date(cursor.lastActivityAt)}
              and ${forumThreads.id} < ${cursor.id}
            )
          )`);
        } else {
          conditions.push(sql`(
            ${score} < ${cursor.score}
            or (${score} = ${cursor.score} and ${forumThreads.lastActivityAt} < ${new Date(cursor.lastActivityAt)})
            or (
              ${score} = ${cursor.score}
              and ${forumThreads.lastActivityAt} = ${new Date(cursor.lastActivityAt)}
              and ${forumThreads.id} < ${cursor.id}
            )
          )`);
        }
      }

      const base = tx
        .select({
          ...getTableColumns(forumThreads),
          zoneTitle: forumZones.title,
          zoneSlug: forumZones.slug,
          zoneType: forumZones.type,
          authorName: sql<string>`coalesce(${users.displayName}, '')`,
          authorUsername: users.username,
          authorAvatarStorageKey: users.avatarStorageKey,
          reactionCount,
          helpfulVoteCount,
          commentCount,
          score,
        })
        .from(forumThreads)
        .innerJoin(forumZones, eq(forumThreads.zoneId, forumZones.id))
        .leftJoin(users, eq(forumThreads.authorId, users.id))
        .where(and(...conditions));

      const rows =
        opts.sort === "recent"
          ? await base
              .orderBy(
                desc(forumThreads.createdAt),
                desc(forumThreads.lastActivityAt),
                desc(forumThreads.id),
              )
              .limit(opts.limit)
          : await base
              .orderBy(desc(score), desc(forumThreads.lastActivityAt), desc(forumThreads.id))
              .limit(opts.limit);
      return rows.map((row) => ({
        ...row,
        reactionCount: Number(row.reactionCount),
        helpfulVoteCount: Number(row.helpfulVoteCount),
        commentCount: Number(row.commentCount),
        score: Number(row.score),
      }));
    });
  }

  async tagsByThread(threadIds: string[], locale: string): Promise<Map<string, ForumTagRow[]>> {
    if (threadIds.length === 0) return new Map();
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ threadId: forumThreadTags.threadId, tag: getTableColumns(forumTags) })
        .from(forumThreadTags)
        .innerJoin(forumTags, eq(forumThreadTags.tagId, forumTags.id))
        .where(and(inArray(forumThreadTags.threadId, threadIds), eq(forumTags.isActive, true)))
        .orderBy(asc(locale === "en" ? forumTags.nameEn : forumTags.nameTr));
      const result = new Map<string, ForumTagRow[]>();
      for (const row of rows) {
        const current = result.get(row.threadId) ?? [];
        current.push(row.tag);
        result.set(row.threadId, current);
      }
      return result;
    });
  }

  async listTags(locale: string, examType?: string | null): Promise<ForumTagRow[]> {
    return withServiceContext(this.db, (tx) => {
      const conditions = [eq(forumTags.isActive, true)];
      if (examType) {
        conditions.push(or(isNull(forumTags.examType), eq(forumTags.examType, examType))!);
      }
      return tx
        .select()
        .from(forumTags)
        .where(and(...conditions))
        .orderBy(asc(locale === "en" ? forumTags.nameEn : forumTags.nameTr));
    });
  }

  async listAllTags(): Promise<ForumTagRow[]> {
    return withServiceContext(this.db, (tx) =>
      tx.select().from(forumTags).orderBy(desc(forumTags.isActive), asc(forumTags.slug)),
    );
  }

  async activeTagCount(tagIds: string[]): Promise<number> {
    if (tagIds.length === 0) return 0;
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(forumTags)
        .where(and(inArray(forumTags.id, tagIds), eq(forumTags.isActive, true)));
      return Number(row?.count ?? 0);
    });
  }

  async replaceThreadTags(threadId: string, tagIds: string[]): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.delete(forumThreadTags).where(eq(forumThreadTags.threadId, threadId));
      if (tagIds.length > 0) {
        await tx
          .insert(forumThreadTags)
          .values(tagIds.map((tagId) => ({ threadId, tagId })))
          .onConflictDoNothing();
      }
    });
  }

  async helpfulCounts(
    targetType: ModerationTargetType,
    targetIds: string[],
  ): Promise<Map<string, number>> {
    if (targetIds.length === 0) return new Map();
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({
          targetId: forumHelpfulVotes.targetId,
          count: sql<number>`count(*)::int`,
        })
        .from(forumHelpfulVotes)
        .where(
          and(
            eq(forumHelpfulVotes.targetType, targetType),
            inArray(forumHelpfulVotes.targetId, targetIds),
          ),
        )
        .groupBy(forumHelpfulVotes.targetId);
      return new Map(rows.map((row) => [row.targetId, Number(row.count)]));
    });
  }

  async myHelpfulTargets(
    targetType: ModerationTargetType,
    targetIds: string[],
    userId: string,
  ): Promise<Set<string>> {
    if (targetIds.length === 0) return new Set();
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ targetId: forumHelpfulVotes.targetId })
        .from(forumHelpfulVotes)
        .where(
          and(
            eq(forumHelpfulVotes.targetType, targetType),
            inArray(forumHelpfulVotes.targetId, targetIds),
            eq(forumHelpfulVotes.userId, userId),
          ),
        );
      return new Set(rows.map((row) => row.targetId));
    });
  }

  async addHelpfulVote(
    targetType: ModerationTargetType,
    targetId: string,
    userId: string,
  ): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx
        .insert(forumHelpfulVotes)
        .values({ targetType, targetId, userId, value: 1 })
        .onConflictDoNothing(),
    );
  }

  async removeHelpfulVote(
    targetType: ModerationTargetType,
    targetId: string,
    userId: string,
  ): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx
        .delete(forumHelpfulVotes)
        .where(
          and(
            eq(forumHelpfulVotes.targetType, targetType),
            eq(forumHelpfulVotes.targetId, targetId),
            eq(forumHelpfulVotes.userId, userId),
          ),
        ),
    );
  }

  async interactionCount(
    targetType: ModerationTargetType,
    targetId: string,
  ): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      if (targetType === "THREAD") {
        const [row] = await tx
          .select({
            count: sql<number>`(
              (select count(*) from ${forumPosts} fp
                where fp.thread_id = ${targetId} and fp.deleted_at is null)
              + (select count(*) from ${forumReactions} fr where fr.thread_id = ${targetId})
              + (select count(*) from ${forumHelpfulVotes} fhv
                where fhv.target_type = 'THREAD' and fhv.target_id = ${targetId})
            )::int`,
          })
          .from(forumThreads)
          .where(eq(forumThreads.id, targetId))
          .limit(1);
        return Number(row?.count ?? 0);
      }
      const [row] = await tx
        .select({
          count: sql<number>`(
            (select count(*) from ${forumPosts} child
              where child.parent_post_id = ${targetId} and child.deleted_at is null)
            + (select count(*) from ${forumPostReactions} fpr where fpr.post_id = ${targetId})
            + (select count(*) from ${forumHelpfulVotes} fhv
              where fhv.target_type = 'POST' and fhv.target_id = ${targetId})
            + (case when ${forumPosts.isAccepted} then 1 else 0 end)
          )::int`,
        })
        .from(forumPosts)
        .where(eq(forumPosts.id, targetId))
        .limit(1);
      return Number(row?.count ?? 0);
    });
  }

  async updateThread(
    threadId: string,
    patch: { body?: string; title?: string | null },
  ): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx
        .update(forumThreads)
        .set({ ...patch, editedAt: new Date(), updatedAt: new Date() })
        .where(eq(forumThreads.id, threadId)),
    );
  }

  async updatePost(postId: string, body: string): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx
        .update(forumPosts)
        .set({ body, editedAt: new Date(), updatedAt: new Date() })
        .where(eq(forumPosts.id, postId)),
    );
  }

  async recentInteractionThreadIds(userId: string, limit: number): Promise<string[]> {
    return withServiceContext(this.db, async (tx) => {
      const result = await tx.execute(sql`
        select thread_id
        from (
          select fp.thread_id, max(fp.created_at) as interacted_at
          from ${forumPosts} fp
          where fp.author_id = ${userId}
            and fp.deleted_at is null
            and fp.created_at >= now() - interval '30 days'
          group by fp.thread_id
          union all
          select fr.thread_id, max(fr.created_at) as interacted_at
          from ${forumReactions} fr
          where fr.user_id = ${userId}
            and fr.created_at >= now() - interval '30 days'
          group by fr.thread_id
          union all
          select fhv.target_id as thread_id, max(fhv.created_at) as interacted_at
          from ${forumHelpfulVotes} fhv
          where fhv.user_id = ${userId}
            and fhv.target_type = 'THREAD'
            and fhv.created_at >= now() - interval '30 days'
          group by fhv.target_id
        ) interactions
        group by thread_id
        order by max(interacted_at) desc
        limit ${limit}
      `);
      return (result.rows as Array<{ thread_id: string }>).map((row) => row.thread_id);
    });
  }

  async trendingTags(locale: string, examType: string | null, limit: number) {
    return withServiceContext(this.db, async (tx) => {
      const conditions = [
        eq(forumTags.isActive, true),
        isNull(forumThreads.deletedAt),
        eq(forumZones.visibility, "PUBLIC"),
        eq(forumZones.isArchived, false),
        sql`${forumThreads.lastActivityAt} >= now() - interval '72 hours'`,
      ];
      if (examType) {
        conditions.push(or(isNull(forumTags.examType), eq(forumTags.examType, examType))!);
        conditions.push(or(isNull(forumZones.examType), eq(forumZones.examType, examType))!);
      }
      const rows = await tx
        .select({
          tag: getTableColumns(forumTags),
          threadCount: sql<number>`count(distinct ${forumThreads.id})::int`,
        })
        .from(forumTags)
        .innerJoin(forumThreadTags, eq(forumThreadTags.tagId, forumTags.id))
        .innerJoin(forumThreads, eq(forumThreadTags.threadId, forumThreads.id))
        .innerJoin(forumZones, eq(forumThreads.zoneId, forumZones.id))
        .where(and(...conditions))
        .groupBy(forumTags.id)
        .orderBy(desc(sql`count(distinct ${forumThreads.id})`), asc(locale === "en" ? forumTags.nameEn : forumTags.nameTr))
        .limit(limit);
      return rows.map((row) => ({ tag: row.tag, threadCount: Number(row.threadCount) }));
    });
  }

  async weeklySupporters(examType: string | null, limit: number): Promise<ForumSupporterRow[]> {
    return withServiceContext(this.db, async (tx) => {
      const conditions = [
        isNull(forumPosts.deletedAt),
        isNull(forumThreads.deletedAt),
        eq(forumZones.visibility, "PUBLIC"),
        eq(forumZones.isArchived, false),
        sql`${forumPosts.createdAt} >= now() - interval '7 days'`,
        sql`${users.username} is not null`,
      ];
      if (examType) {
        conditions.push(or(isNull(forumZones.examType), eq(forumZones.examType, examType))!);
      }
      const rows = await tx
        .select({
          id: users.id,
          displayName: users.displayName,
          username: users.username,
          avatarStorageKey: users.avatarStorageKey,
          latest: sql<Date>`max(${forumPosts.createdAt})`,
        })
        .from(forumPosts)
        .innerJoin(forumThreads, eq(forumPosts.threadId, forumThreads.id))
        .innerJoin(forumZones, eq(forumThreads.zoneId, forumZones.id))
        .innerJoin(users, eq(forumPosts.authorId, users.id))
        .where(and(...conditions))
        .groupBy(users.id)
        .orderBy(desc(sql`max(${forumPosts.createdAt})`))
        .limit(limit);
      return rows.map(({ latest: _latest, ...row }) => row as ForumSupporterRow);
    });
  }

  async searchThreadSummaries(q: string, limit: number): Promise<ForumThreadSummaryRow[]> {
    return withServiceContext(this.db, async (tx) => {
      const match = sql`to_tsvector('turkish', coalesce(${forumThreads.title}, '') || ' ' || ${forumThreads.body}) @@ websearch_to_tsquery('turkish', ${q})`;
      return tx
        .select({
          id: forumThreads.id,
          zoneSlug: forumZones.slug,
          zoneTitle: forumZones.title,
          zoneType: forumZones.type,
          title: forumThreads.title,
          body: forumThreads.body,
          commentCount: sql<number>`(
            select count(*) from ${forumPosts} fp
            where fp.thread_id = ${forumThreads.id} and fp.deleted_at is null
          )::int`,
          lastActivityAt: forumThreads.lastActivityAt,
        })
        .from(forumThreads)
        .innerJoin(forumZones, eq(forumThreads.zoneId, forumZones.id))
        .where(
          and(
            isNull(forumThreads.deletedAt),
            eq(forumZones.visibility, "PUBLIC"),
            eq(forumZones.isArchived, false),
            match,
          ),
        )
        .orderBy(
          desc(
            sql`ts_rank(to_tsvector('turkish', coalesce(${forumThreads.title}, '') || ' ' || ${forumThreads.body}), websearch_to_tsquery('turkish', ${q}))`,
          ),
          desc(forumThreads.lastActivityAt),
        )
        .limit(limit);
    });
  }

  async searchTags(q: string, limit: number): Promise<ForumTagRow[]> {
    return withServiceContext(this.db, (tx) =>
      tx
        .select()
        .from(forumTags)
        .where(
          and(
            eq(forumTags.isActive, true),
            or(
              sql`lower(${forumTags.nameTr}) like ${`%${q.toLocaleLowerCase("tr-TR")}%`}`,
              sql`lower(${forumTags.nameEn}) like ${`%${q.toLowerCase()}%`}`,
              sql`${forumTags.slug} like ${`%${q.toLowerCase()}%`}`,
            ),
          ),
        )
        .orderBy(asc(forumTags.slug))
        .limit(limit),
    );
  }

  async zoneContributors(zoneId: string, limit: number): Promise<ForumSupporterRow[]> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({
          id: users.id,
          displayName: users.displayName,
          username: users.username,
          avatarStorageKey: users.avatarStorageKey,
          latest: sql<Date>`max(${forumThreads.lastActivityAt})`,
        })
        .from(forumThreads)
        .innerJoin(users, eq(forumThreads.authorId, users.id))
        .where(
          and(
            eq(forumThreads.zoneId, zoneId),
            isNull(forumThreads.deletedAt),
            sql`${users.username} is not null`,
          ),
        )
        .groupBy(users.id)
        .orderBy(desc(sql`max(${forumThreads.lastActivityAt})`))
        .limit(limit);
      return rows.map(({ latest: _latest, ...row }) => row as ForumSupporterRow);
    });
  }

  async pinnedThreadSummaries(zoneId: string, limit: number): Promise<ForumThreadSummaryRow[]> {
    return withServiceContext(this.db, (tx) =>
      tx
        .select({
          id: forumThreads.id,
          zoneSlug: forumZones.slug,
          zoneTitle: forumZones.title,
          zoneType: forumZones.type,
          title: forumThreads.title,
          body: forumThreads.body,
          commentCount: sql<number>`(
            select count(*) from ${forumPosts} fp
            where fp.thread_id = ${forumThreads.id} and fp.deleted_at is null
          )::int`,
          lastActivityAt: forumThreads.lastActivityAt,
        })
        .from(forumThreads)
        .innerJoin(forumZones, eq(forumThreads.zoneId, forumZones.id))
        .where(
          and(
            eq(forumThreads.zoneId, zoneId),
            eq(forumThreads.isPinned, true),
            isNull(forumThreads.deletedAt),
          ),
        )
        .orderBy(desc(forumThreads.lastActivityAt))
        .limit(limit),
    );
  }

  async upsertTag(
    actorId: string,
    input: {
      id?: string;
      slug?: string;
      nameTr?: string;
      nameEn?: string;
      examType?: string | null;
      isActive?: boolean;
    },
  ): Promise<ForumTagRow> {
    return withServiceContext(this.db, async (tx) => {
      if (input.id) {
        const { id, ...patch } = input;
        const [row] = await tx
          .update(forumTags)
          .set({ ...patch, updatedBy: actorId, updatedAt: new Date() })
          .where(eq(forumTags.id, id))
          .returning();
        return row!;
      }
      const [row] = await tx
        .insert(forumTags)
        .values({
          slug: input.slug!,
          nameTr: input.nameTr!,
          nameEn: input.nameEn!,
          examType: input.examType ?? null,
          isActive: input.isActive ?? true,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();
      return row!;
    });
  }

  async getFeaturedThread(): Promise<ForumFeaturedThreadRow | null> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx
        .select({
          id: forumThreads.id,
          zoneSlug: forumZones.slug,
          zoneTitle: forumZones.title,
          zoneType: forumZones.type,
          title: forumThreads.title,
          body: forumThreads.body,
          commentCount: sql<number>`(
            select count(*) from ${forumPosts} fp
            where fp.thread_id = ${forumThreads.id} and fp.deleted_at is null
          )::int`,
          lastActivityAt: forumThreads.lastActivityAt,
          featuredUntil: forumThreads.featuredUntil,
          featuredBy: forumThreads.featuredBy,
        })
        .from(forumThreads)
        .innerJoin(forumZones, eq(forumThreads.zoneId, forumZones.id))
        .where(
          and(
            sql`${forumThreads.featuredUntil} > now()`,
            isNull(forumThreads.deletedAt),
            eq(forumZones.isArchived, false),
          ),
        )
        .orderBy(desc(forumThreads.featuredUntil))
        .limit(1);
      return row?.featuredUntil ? { ...row, featuredUntil: row.featuredUntil } : null;
    });
  }

  async setFeaturedThread(
    threadId: string,
    actorId: string,
    featuredUntil: Date,
  ): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .update(forumThreads)
        .set({ featuredUntil: null, featuredBy: null })
        .where(sql`${forumThreads.featuredUntil} > now()`);
      await tx
        .update(forumThreads)
        .set({ featuredUntil, featuredBy: actorId, updatedAt: new Date() })
        .where(and(eq(forumThreads.id, threadId), isNull(forumThreads.deletedAt)));
    });
  }

  async clearFeaturedThread(): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx
        .update(forumThreads)
        .set({ featuredUntil: null, featuredBy: null, updatedAt: new Date() })
        .where(sql`${forumThreads.featuredUntil} is not null`),
    );
  }

  async recommendedZoneIds(viewerId: string, examType: string | null, limit: number): Promise<string[]> {
    return withServiceContext(this.db, async (tx) => {
      const conditions = [
        eq(forumZones.visibility, "PUBLIC"),
        eq(forumZones.isArchived, false),
        sql`not exists (
          select 1 from ${forumZoneMembers} fzm
          where fzm.zone_id = ${forumZones.id}
            and fzm.user_id = ${viewerId}
            and fzm.status = 'ACTIVE'
        )`,
      ];
      if (examType) {
        conditions.push(or(isNull(forumZones.examType), eq(forumZones.examType, examType))!);
      }
      const rows = await tx
        .select({ id: forumZones.id })
        .from(forumZones)
        .where(and(...conditions))
        .orderBy(
          desc(sql`(select count(*) from ${forumThreads} ft where ft.zone_id = ${forumZones.id} and ft.deleted_at is null)`),
          asc(forumZones.title),
        )
        .limit(limit);
      return rows.map((row) => row.id);
    });
  }
}
