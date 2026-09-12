import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import {
  mentorshipStudentBriefs as briefs,
  type MentorshipBriefDeltaRecord,
  type MentorshipBriefSnapshot,
} from "../../../database/schema";

export type BriefHistoryRow = typeof briefs.$inferSelect;

export interface BriefHistoryInsert {
  linkId: string;
  periodId: string;
  brief: string;
  model: string;
  fingerprint: string;
  snapshot: MentorshipBriefSnapshot;
  delta: MentorshipBriefDeltaRecord | null;
}

/**
 * Every brief a coach was actually shown about one student (APP-093).
 *
 * SERVICE context with application-layer scoping, like the rest of W8's cross-user tables: the
 * caller has already passed `MentorshipLinkService.requireActiveLink`, and every method here takes
 * the `(linkId, periodId)` that gate returned rather than looking a relationship up for itself.
 *
 * Every read is period-scoped. Re-linking rotates `coach_students.period_id`, so a revived
 * relationship starts with an empty history instead of resurfacing briefs about a relationship both
 * sides had walked away from (APP-071's rule for the standing note, kept).
 */
@Injectable()
export class MentorshipBriefHistoryRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The brief the next delta is measured against, or undefined on the first of a period. */
  findLatest(linkId: string, periodId: string): Promise<BriefHistoryRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(briefs)
        .where(and(eq(briefs.linkId, linkId), eq(briefs.periodId, periodId)))
        .orderBy(desc(briefs.generatedAt), desc(briefs.id))
        .limit(1);
      return rows[0];
    });
  }

  /**
   * Append one brief and drop anything past the retention limit.
   *
   * Trimming inside the insert's own transaction is what makes the limit a limit: two generations
   * racing would otherwise both read "at the ceiling" and leave the table one row over.
   *
   * Deletes by id rather than by a timestamp cutoff so two briefs written in the same microsecond
   * cannot both survive a trim meant to remove one. The 100-row ceiling bounds a single call:
   * lowering `mentorship.brief.history_limit` far below the stored count trims over the next few
   * generations rather than in one statement, which is the safer direction for a knob.
   */
  async append(input: BriefHistoryInsert, historyLimit: number): Promise<BriefHistoryRow> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx.insert(briefs).values(input).returning();
      const stale = await tx
        .select({ id: briefs.id })
        .from(briefs)
        .where(and(eq(briefs.linkId, input.linkId), eq(briefs.periodId, input.periodId)))
        .orderBy(desc(briefs.generatedAt), desc(briefs.id))
        .limit(100)
        .offset(historyLimit);
      if (stale.length > 0) {
        await tx.delete(briefs).where(inArray(briefs.id, stale.map((entry) => entry.id)));
      }
      return row!;
    });
  }

  /** The coach paging back through this relationship's briefs, newest first. */
  list(
    linkId: string,
    periodId: string,
    page: number,
    pageSize: number,
  ): Promise<{ rows: BriefHistoryRow[]; total: number }> {
    return withServiceContext(this.db, async (tx) => {
      const where = and(eq(briefs.linkId, linkId), eq(briefs.periodId, periodId));
      const rows = await tx
        .select()
        .from(briefs)
        .where(where)
        .orderBy(desc(briefs.generatedAt), desc(briefs.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
      const [total] = await tx.select({ n: count() }).from(briefs).where(where);
      return { rows, total: total?.n ?? 0 };
    });
  }
}
