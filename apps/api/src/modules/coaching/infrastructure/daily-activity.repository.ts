import { Injectable } from "@nestjs/common";
import { and, eq, gte, or, sql } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { dailyActivity } from "../../../database/schema";

export type DailyActivityRow = typeof dailyActivity.$inferSelect;

/**
 * Data access for `daily_activity` — the per-day activity ledger that read-time streak
 * derivation reads. Upserts are keyed on the (user_id, activity_date) unique index.
 */
@Injectable()
export class DailyActivityRepository {
  async getSessionRepeatStats(
    tx: DatabaseTx,
    fromDate: string,
    toDate: string,
  ): Promise<{ activeUsers7d: number; repeatUsers7d: number }> {
    const result = await tx.execute<{
      active_users: number;
      repeat_users: number;
    }>(sql`
      SELECT
        count(*)::int AS active_users,
        count(*) FILTER (WHERE session_days >= 2)::int AS repeat_users
      FROM (
        SELECT user_id, count(*)::int AS session_days
        FROM ${dailyActivity}
        WHERE activity_date >= ${fromDate}
          AND activity_date <= ${toDate}
          AND has_session = true
        GROUP BY user_id
      ) session_activity
    `);
    const row = result.rows[0];
    return {
      activeUsers7d: Number(row?.active_users ?? 0),
      repeatUsers7d: Number(row?.repeat_users ?? 0),
    };
  }

  async findByDate(
    tx: DatabaseTx,
    userId: string,
    date: string,
  ): Promise<DailyActivityRow | undefined> {
    const rows = await tx
      .select()
      .from(dailyActivity)
      .where(and(eq(dailyActivity.userId, userId), eq(dailyActivity.activityDate, date)))
      .limit(1);
    return rows[0];
  }

  /** Upsert the `tasks_done` count for a day (recomputed from plan_tasks, not incremented). */
  async upsertTasksDone(
    tx: DatabaseTx,
    userId: string,
    date: string,
    tasksDone: number,
  ): Promise<void> {
    await tx
      .insert(dailyActivity)
      .values({ userId, activityDate: date, tasksDone })
      .onConflictDoUpdate({
        target: [dailyActivity.userId, dailyActivity.activityDate],
        set: { tasksDone },
      });
  }

  /** Upsert the `has_session` flag for a day. */
  async upsertHasSession(
    tx: DatabaseTx,
    userId: string,
    date: string,
    hasSession: boolean,
  ): Promise<void> {
    await tx
      .insert(dailyActivity)
      .values({ userId, activityDate: date, hasSession })
      .onConflictDoUpdate({
        target: [dailyActivity.userId, dailyActivity.activityDate],
        set: { hasSession },
      });
  }

  /** Active days (≥1 session OR ≥1 done task) on/after `sinceDate`, for streak derivation. */
  async listActiveDatesSince(
    tx: DatabaseTx,
    userId: string,
    sinceDate: string,
  ): Promise<string[]> {
    const rows = await tx
      .select({ activityDate: dailyActivity.activityDate })
      .from(dailyActivity)
      .where(
        and(
          eq(dailyActivity.userId, userId),
          gte(dailyActivity.activityDate, sinceDate),
          or(eq(dailyActivity.hasSession, true), sql`${dailyActivity.tasksDone} > 0`),
        ),
      );
    return rows.map((r) => r.activityDate);
  }
}
