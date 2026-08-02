import { Injectable } from "@nestjs/common";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { planTasks } from "../../../database/schema";

export type PlanTaskRow = typeof planTasks.$inferSelect;
export type NewPlanTask = typeof planTasks.$inferInsert;

/**
 * Display order within one day: all-day items first, then timed items chronologically, then the
 * user's manual order. Postgres defaults ASC to NULLS LAST, so `nulls first` is explicit.
 */
const withinDayOrder = [
  sql`${planTasks.startTime} asc nulls first`,
  asc(planTasks.sortOrder),
  asc(planTasks.createdAt),
];

/** Transaction-scoped lock shared by every plan writer, including KVKK erasure. */
export async function acquireUserPlanLock(tx: DatabaseTx, userId: string): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${"coaching:plan:" + userId}, 0))`,
  );
}

/**
 * Data access for `plan_tasks`. Methods receive the RLS-scoped `tx` opened by the service
 * via `withUserContext`, so multi-table writes (task ↔ daily_activity) stay in one transaction.
 * Every query also filters by `user_id` (double belt with RLS — backend standard).
 */
@Injectable()
export class PlanTaskRepository {
  /** Serialize every plan mutation for one user within the caller's transaction. */
  async acquireUserLock(tx: DatabaseTx, userId: string): Promise<void> {
    await acquireUserPlanLock(tx, userId);
  }

  /** All of a user's tasks for a date, ordered for display (no pagination — bounded per day). */
  listByDate(tx: DatabaseTx, userId: string, date: string): Promise<PlanTaskRow[]> {
    return tx
      .select()
      .from(planTasks)
      .where(and(eq(planTasks.userId, userId), eq(planTasks.taskDate, date)))
      .orderBy(...withinDayOrder);
  }

  /** Bounded internal read used by the seven-day coach adaptation snapshot. */
  listByDateRange(
    tx: DatabaseTx,
    userId: string,
    from: string,
    to: string,
  ): Promise<PlanTaskRow[]> {
    return tx
      .select()
      .from(planTasks)
      .where(
        and(
          eq(planTasks.userId, userId),
          gte(planTasks.taskDate, from),
          lte(planTasks.taskDate, to),
        ),
      )
      .orderBy(asc(planTasks.taskDate), ...withinDayOrder);
  }

  /** Paginated list for a date (kept paginated to honor the "no unbounded list" standard). */
  async listByDatePaged(
    tx: DatabaseTx,
    userId: string,
    date: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: PlanTaskRow[]; total: number }> {
    const where = and(eq(planTasks.userId, userId), eq(planTasks.taskDate, date));
    const [items, totalRow] = await Promise.all([
      tx
        .select()
        .from(planTasks)
        .where(where)
        .orderBy(...withinDayOrder)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      tx.select({ count: sql<number>`count(*)::int` }).from(planTasks).where(where),
    ]);
    return { items, total: totalRow[0]?.count ?? 0 };
  }

  /** Paginated list for an inclusive date range (week/calendar views). */
  async listByDateRangePaged(
    tx: DatabaseTx,
    userId: string,
    from: string,
    to: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: PlanTaskRow[]; total: number }> {
    const where = and(
      eq(planTasks.userId, userId),
      gte(planTasks.taskDate, from),
      lte(planTasks.taskDate, to),
    );
    const [items, totalRow] = await Promise.all([
      tx
        .select()
        .from(planTasks)
        .where(where)
        .orderBy(asc(planTasks.taskDate), ...withinDayOrder)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      tx.select({ count: sql<number>`count(*)::int` }).from(planTasks).where(where),
    ]);
    return { items, total: totalRow[0]?.count ?? 0 };
  }

  /** Distinct task dates in an inclusive range — for calendar dot indicators. */
  async listDistinctDatesInRange(
    tx: DatabaseTx,
    userId: string,
    from: string,
    to: string,
  ): Promise<string[]> {
    const rows = await tx
      .selectDistinct({ taskDate: planTasks.taskDate })
      .from(planTasks)
      .where(
        and(
          eq(planTasks.userId, userId),
          gte(planTasks.taskDate, from),
          lte(planTasks.taskDate, to),
        ),
      )
      .orderBy(asc(planTasks.taskDate));
    return rows.map((row) => row.taskDate);
  }

  async findById(tx: DatabaseTx, userId: string, id: string): Promise<PlanTaskRow | undefined> {
    const rows = await tx
      .select()
      .from(planTasks)
      .where(and(eq(planTasks.id, id), eq(planTasks.userId, userId)))
      .limit(1);
    return rows[0];
  }

  async create(tx: DatabaseTx, data: NewPlanTask): Promise<PlanTaskRow> {
    const rows = await tx.insert(planTasks).values(data).returning();
    return rows[0]!;
  }

  async update(
    tx: DatabaseTx,
    userId: string,
    id: string,
    patch: Partial<NewPlanTask>,
  ): Promise<PlanTaskRow | undefined> {
    const rows = await tx
      .update(planTasks)
      .set(patch)
      .where(and(eq(planTasks.id, id), eq(planTasks.userId, userId)))
      .returning();
    return rows[0];
  }

  async delete(tx: DatabaseTx, userId: string, id: string): Promise<boolean> {
    const rows = await tx
      .delete(planTasks)
      .where(and(eq(planTasks.id, id), eq(planTasks.userId, userId)))
      .returning({ id: planTasks.id });
    return rows.length > 0;
  }

  /** Count of DONE tasks for a date — the source for `daily_activity.tasks_done`. */
  async countDone(tx: DatabaseTx, userId: string, date: string): Promise<number> {
    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(planTasks)
      .where(
        and(
          eq(planTasks.userId, userId),
          eq(planTasks.taskDate, date),
          eq(planTasks.status, "DONE"),
        ),
      );
    return rows[0]?.count ?? 0;
  }

  /** Count of ALL tasks for a date regardless of status. */
  async countTotal(tx: DatabaseTx, userId: string, date: string): Promise<number> {
    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(planTasks)
      .where(and(eq(planTasks.userId, userId), eq(planTasks.taskDate, date)));
    return rows[0]?.count ?? 0;
  }

  /** DONE tasks dated within [fromDate, toDate] (weekly quest window). */
  async countDoneBetween(
    tx: DatabaseTx,
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<number> {
    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(planTasks)
      .where(
        and(
          eq(planTasks.userId, userId),
          gte(planTasks.taskDate, fromDate),
          lte(planTasks.taskDate, toDate),
          eq(planTasks.status, "DONE"),
        ),
      );
    return rows[0]?.count ?? 0;
  }

  async countDoneAllTime(tx: DatabaseTx, userId: string): Promise<number> {
    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(planTasks)
      .where(and(eq(planTasks.userId, userId), eq(planTasks.status, "DONE")));
    return rows[0]?.count ?? 0;
  }

  async createFromAiCoach(
    tx: DatabaseTx,
    data: NewPlanTask & { originRefId: string },
  ): Promise<PlanTaskRow> {
    const [created] = await tx
      .insert(planTasks)
      .values(data)
      .onConflictDoNothing()
      .returning();
    if (created) return created;
    const [existing] = await tx
      .select()
      .from(planTasks)
      .where(
        and(
          eq(planTasks.userId, data.userId),
          eq(planTasks.originType, "AI_COACH"),
          eq(planTasks.originRefId, data.originRefId),
        ),
      )
      .limit(1);
    if (!existing) throw new Error("AI coach task idempotency conflict");
    return existing;
  }

  /** Outcome-only AI task evidence. Titles and descriptions are intentionally not selected. */
  async aiCoachOutcomeSummary(
    tx: DatabaseTx,
    userId: string,
  ): Promise<{
    accepted: number;
    completed: number;
    lastStatus: "PENDING" | "DONE" | null;
    observedAt: Date | null;
    pendingTaskId: string | null;
  }> {
    const where = and(
      eq(planTasks.userId, userId),
      eq(planTasks.originType, "AI_COACH"),
    );
    const [aggregate, latest, pending] = await Promise.all([
      tx
        .select({
          accepted: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where ${planTasks.status} = 'DONE')::int`,
        })
        .from(planTasks)
        .where(where),
      tx
        .select({ status: planTasks.status, updatedAt: planTasks.updatedAt })
        .from(planTasks)
        .where(where)
        .orderBy(desc(planTasks.updatedAt), desc(planTasks.id))
        .limit(1),
      tx
        .select({ id: planTasks.id })
        .from(planTasks)
        .where(and(where, eq(planTasks.status, "PENDING")))
        .orderBy(desc(planTasks.updatedAt), desc(planTasks.id))
        .limit(1),
    ]);
    const last = latest[0];
    return {
      accepted: aggregate[0]?.accepted ?? 0,
      completed: aggregate[0]?.completed ?? 0,
      lastStatus:
        last?.status === "DONE" || last?.status === "PENDING"
          ? last.status
          : null,
      observedAt: last?.updatedAt ?? null,
      pendingTaskId: pending[0]?.id ?? null,
    };
  }
}
