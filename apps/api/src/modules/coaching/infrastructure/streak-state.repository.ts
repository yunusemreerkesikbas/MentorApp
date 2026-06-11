import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { streakState } from "../../../database/schema";

export type StreakStateRow = typeof streakState.$inferSelect;
export type NewStreakState = typeof streakState.$inferInsert;

/** Data access for `streak_state` (one row per user; current is a derived snapshot/cache). */
@Injectable()
export class StreakStateRepository {
  async findByUser(tx: DatabaseTx, userId: string): Promise<StreakStateRow | undefined> {
    const rows = await tx
      .select()
      .from(streakState)
      .where(eq(streakState.userId, userId))
      .limit(1);
    return rows[0];
  }

  /** Upsert the per-user streak snapshot (keyed on the user_id unique index). */
  async upsert(
    tx: DatabaseTx,
    userId: string,
    patch: Omit<NewStreakState, "userId">,
  ): Promise<StreakStateRow> {
    const rows = await tx
      .insert(streakState)
      .values({ userId, ...patch })
      .onConflictDoUpdate({ target: streakState.userId, set: patch })
      .returning();
    return rows[0]!;
  }
}
