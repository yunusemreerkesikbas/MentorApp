import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { coachMemory } from "../../../database/schema";

export interface CoachMemoryRow {
  summary: string;
  model: string;
  messageCount: number;
  updatedAt: Date;
}

/**
 * Coach memory profile (W3): one distilled PII-free summary per user. All access runs in the
 * user's RLS context (per-user behavioral data, §4 #6 / KVKK) — the refresh job passes the userId too.
 */
@Injectable()
export class CoachMemoryRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async get(userId: string): Promise<CoachMemoryRow | null> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await tx.select().from(coachMemory).where(eq(coachMemory.userId, userId)).limit(1);
      const row = rows[0];
      return row
        ? {
            summary: row.summary,
            model: row.model,
            messageCount: row.messageCount,
            updatedAt: row.updatedAt,
          }
        : null;
    });
  }

  /** Upsert the single profile row (unique per user). Called by the refresh job. */
  async upsert(
    userId: string,
    data: { summary: string; model: string; messageCount: number },
  ): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      await tx
        .insert(coachMemory)
        .values({ userId, ...data, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: coachMemory.userId,
          set: { ...data, updatedAt: new Date() },
        });
    });
  }

  /** KVKK erasure: drop the profile from an admin context (target user, not the caller). Idempotent. */
  async deleteAllForUser(userId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.delete(coachMemory).where(eq(coachMemory.userId, userId));
    });
  }

  async clear(userId: string): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      await tx.delete(coachMemory).where(eq(coachMemory.userId, userId));
    });
  }
}
