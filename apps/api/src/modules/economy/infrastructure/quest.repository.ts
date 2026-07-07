import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { userQuestProgress } from "../../../database/schema";

export type QuestProgressRow = typeof userQuestProgress.$inferSelect;

/** Per-user quest completion (SERVICE context — system-managed; double-belt idempotent). */
@Injectable()
export class QuestRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  withServiceTx<T>(fn: (tx: DatabaseTx) => Promise<T>): Promise<T> {
    return withServiceContext(this.db, fn);
  }

  /**
   * Record a completion. Idempotent on (userId, questId, periodKey): returns the row only when
   * newly inserted, undefined if it already existed — so the caller grants the reward at most once.
   */
  async markCompleted(
    userId: string,
    questId: string,
    periodKey: string,
    exec?: DatabaseTx,
  ): Promise<QuestProgressRow | undefined> {
    const run = async (tx: DatabaseTx) => {
      const rows = await tx
        .insert(userQuestProgress)
        .values({ userId, questId, periodKey, status: "COMPLETED" })
        .onConflictDoNothing()
        .returning();
      return rows[0];
    };
    return exec ? run(exec) : withServiceContext(this.db, run);
  }

  async listForUser(
    userId: string,
    periodKeys?: readonly string[],
  ): Promise<QuestProgressRow[]> {
    return withServiceContext(this.db, (tx) =>
      tx
        .select()
        .from(userQuestProgress)
        .where(
          periodKeys?.length
            ? and(
                eq(userQuestProgress.userId, userId),
                inArray(userQuestProgress.periodKey, [...periodKeys]),
              )
            : eq(userQuestProgress.userId, userId),
        ),
    );
  }
}
