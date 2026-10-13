import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { forumModerationActions, forumPosts, forumReports, forumThreads } from "../../../database/schema";

export type ReportRow = typeof forumReports.$inferSelect;
/** A queue row with the start of what was reported, so the moderator can judge without opening it. */
export type ReportListRow = ReportRow & { excerpt: string | null };

/** First 160 characters of the reported thread (title, else body) or post, deleted or not. */
const EXCERPT = sql<string | null>`case ${forumReports.targetType}
  when 'THREAD' then (select left(coalesce(t.title, t.body), 160) from ${forumThreads} t where t.id = ${forumReports.targetId})
  else (select left(p.body, 160) from ${forumPosts} p where p.id = ${forumReports.targetId})
end`;
const LIST_COLUMNS = { ...getTableColumns(forumReports), excerpt: EXCERPT };
type NewAction = typeof forumModerationActions.$inferInsert;

/**
 * Moderation access (slice 5). Reports + the append-only action audit. All access runs in SERVICE
 * context and is policy-checked in the app (forum.policy.canModerateZone) — like the member lists.
 */
@Injectable()
export class ForumReportRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Idempotent on (target_type, target_id, reporter_id): a re-report is a no-op. */
  async create(input: {
    targetType: string;
    targetId: string;
    zoneId: string;
    reporterId: string;
    reason: string;
    note?: string | null;
  }): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .insert(forumReports)
        .values({
          targetType: input.targetType,
          targetId: input.targetId,
          zoneId: input.zoneId,
          reporterId: input.reporterId,
          reason: input.reason,
          note: input.note ?? null,
        })
        .onConflictDoNothing();
    });
  }

  async findById(id: string): Promise<ReportRow | null> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx.select().from(forumReports).where(eq(forumReports.id, id)).limit(1);
      return row ?? null;
    });
  }

  async listByZone(
    zoneId: string,
    opts: { status?: string; page: number; pageSize: number },
  ): Promise<ReportListRow[]> {
    return withServiceContext(this.db, async (tx) => {
      const conds = [eq(forumReports.zoneId, zoneId)];
      if (opts.status) conds.push(eq(forumReports.status, opts.status));
      return tx
        .select(LIST_COLUMNS)
        .from(forumReports)
        .where(and(...conds))
        .orderBy(desc(forumReports.createdAt))
        .limit(opts.pageSize)
        .offset((opts.page - 1) * opts.pageSize);
    });
  }

  async listAll(opts: { status?: string; page: number; pageSize: number }): Promise<ReportListRow[]> {
    return withServiceContext(this.db, async (tx) => {
      const where = opts.status ? eq(forumReports.status, opts.status) : undefined;
      return tx
        .select(LIST_COLUMNS)
        .from(forumReports)
        .where(where)
        .orderBy(desc(forumReports.createdAt))
        .limit(opts.pageSize)
        .offset((opts.page - 1) * opts.pageSize);
    });
  }

  async countByZone(zoneId: string, status?: string): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const conds = [eq(forumReports.zoneId, zoneId)];
      if (status) conds.push(eq(forumReports.status, status));
      const rows = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(forumReports)
        .where(and(...conds));
      return rows[0]?.count ?? 0;
    });
  }

  async countAll(status?: string): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(forumReports)
        .where(status ? eq(forumReports.status, status) : undefined);
      return rows[0]?.count ?? 0;
    });
  }

  /**
   * Resolve EVERY still-open report for a target in one shot, so a HIDE/DISMISS doesn't leave
   * sibling reports (other users flagging the same content) orphaned as OPEN in the queue.
   */
  async setResolvedByTarget(
    targetType: string,
    targetId: string,
    status: string,
    byUserId: string,
  ): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .update(forumReports)
        .set({ status, resolvedBy: byUserId, resolvedAt: new Date() })
        .where(
          and(
            eq(forumReports.targetType, targetType),
            eq(forumReports.targetId, targetId),
            eq(forumReports.status, "OPEN"),
          ),
        );
    });
  }

  /** Append an immutable moderation-audit row. */
  async appendAction(action: NewAction): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.insert(forumModerationActions).values(action);
    });
  }
}
