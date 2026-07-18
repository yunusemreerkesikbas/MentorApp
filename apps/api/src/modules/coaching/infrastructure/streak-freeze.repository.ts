import { Injectable } from "@nestjs/common";
import { and, eq, gte } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { streakFreezes } from "../../../database/schema";

/**
 * Data access for `streak_freezes` — coin-purchased freeze days (immutable, one row per day).
 * The derivation treats these as unconditional bridges; rows are never updated or deleted.
 */
@Injectable()
export class StreakFreezeRepository {
  /** Purchased freeze days on/after `sinceDate` (bounded like the activity lookback). */
  async listDatesSince(tx: DatabaseTx, userId: string, sinceDate: string): Promise<string[]> {
    const rows = await tx
      .select({ date: streakFreezes.date })
      .from(streakFreezes)
      .where(and(eq(streakFreezes.userId, userId), gte(streakFreezes.date, sinceDate)));
    return rows.map((r) => r.date);
  }

  /** Insert one frozen day; idempotent on (userId, date). False when it already existed. */
  async insert(tx: DatabaseTx, userId: string, date: string): Promise<boolean> {
    const rows = await tx
      .insert(streakFreezes)
      .values({ userId, date })
      .onConflictDoNothing()
      .returning({ id: streakFreezes.id });
    return rows.length > 0;
  }
}
