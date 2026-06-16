import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { userQuestProgress } from "../../../database/schema";

export type QuestProgressRow = typeof userQuestProgress.$inferSelect;

/** Per-user quest completion (SERVICE context — system-managed; double-belt idempotent). */
@Injectable()
export class QuestRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Record a completion. Idempotent on (userId, questId): returns the row only when newly inserted,
   * undefined if it already existed — so the caller grants the reward at most once.
   */
  async markCompleted(userId: string, questId: string): Promise<QuestProgressRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .insert(userQuestProgress)
        .values({ userId, questId, status: "COMPLETED" })
        .onConflictDoNothing()
        .returning();
      return rows[0];
    });
  }

  async listForUser(userId: string): Promise<QuestProgressRow[]> {
    return withServiceContext(this.db, (tx) =>
      tx.select().from(userQuestProgress).where(eq(userQuestProgress.userId, userId)),
    );
  }
}
