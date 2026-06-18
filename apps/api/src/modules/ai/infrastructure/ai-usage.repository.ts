import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { aiUsage } from "../../../database/schema";

/** AI usage meter (W3, §7). Append-only token/cost rows (no prompt/reply text, §4 #6). SERVICE ctx. */
@Injectable()
export class AiUsageRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async append(row: {
    userId: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    costMicros: number;
  }): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.insert(aiUsage).values(row);
    });
  }

  /** Count a user's calls since `since` — drives the premium daily rate-limit. */
  async countSince(userId: string, since: Date): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(aiUsage)
        .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, since)));
      return rows[0]?.n ?? 0;
    });
  }
}
