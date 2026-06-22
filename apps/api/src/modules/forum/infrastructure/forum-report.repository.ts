import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { forumModerationActions, forumReports } from "../../../database/schema";

export type ReportRow = typeof forumReports.$inferSelect;
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
  ): Promise<ReportRow[]> {
    return withServiceContext(this.db, async (tx) => {
      const conds = [eq(forumReports.zoneId, zoneId)];
      if (opts.status) conds.push(eq(forumReports.status, opts.status));
      return tx
        .select()
        .from(forumReports)
        .where(and(...conds))
        .orderBy(desc(forumReports.createdAt))
        .limit(opts.pageSize)
        .offset((opts.page - 1) * opts.pageSize);
    });
  }

  async listAll(opts: { status?: string; page: number; pageSize: number }): Promise<ReportRow[]> {
    return withServiceContext(this.db, async (tx) => {
      const where = opts.status ? eq(forumReports.status, opts.status) : undefined;
      return tx
        .select()
        .from(forumReports)
        .where(where)
        .orderBy(desc(forumReports.createdAt))
        .limit(opts.pageSize)
        .offset((opts.page - 1) * opts.pageSize);
    });
  }

  async setResolved(id: string, status: string, byUserId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .update(forumReports)
        .set({ status, resolvedBy: byUserId, resolvedAt: new Date() })
        .where(eq(forumReports.id, id));
    });
  }

  /** Append an immutable moderation-audit row. */
  async appendAction(action: NewAction): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.insert(forumModerationActions).values(action);
    });
  }
}
