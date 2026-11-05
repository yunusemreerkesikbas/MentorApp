import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, lte, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { aiUsage } from "../../../database/schema";
import { aiChatQuotaAttempts } from "../../../database/schema-chat-quota";
import { AiUsageFeature } from "../domain/ai.constants";
import { CHAT_MONTH_MS, chatQuotaStatus, type ChatQuotaLimits } from "../domain/premium-chat-quota";

@Injectable()
export class PremiumChatQuotaRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  read(userId: string, limits: ChatQuotaLimits) {
    return withServiceContext(this.db, (tx) => this.readInTx(tx, userId, limits, new Date()));
  }

  reserve(userId: string, limits: ChatQuotaLimits) {
    return withServiceContext(this.db, async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`premium-chat:${userId}`}, 0))`,
      );
      const now = new Date();
      const status = await this.readInTx(tx, userId, limits, now);
      if (status.dailyRemaining === 0 || status.monthlyRemaining === 0) return { status };

      await tx.delete(aiChatQuotaAttempts).where(and(
        eq(aiChatQuotaAttempts.userId, userId),
        lte(aiChatQuotaAttempts.createdAt, new Date(now.getTime() - CHAT_MONTH_MS)),
      ));
      const id = randomUUID();
      await tx.insert(aiChatQuotaAttempts).values({ id, userId, createdAt: now });
      return { id, status };
    });
  }

  private async readInTx(tx: DatabaseTx, userId: string, limits: ChatQuotaLimits, now: Date) {
    const since = new Date(now.getTime() - CHAT_MONTH_MS);
    // Both sources must use one snapshot because settlement swaps an attempt for a usage row.
    const { rows } = await tx.execute<{ created_at_ms: number }>(sql`
      select (extract(epoch from created_at) * 1000)::double precision as created_at_ms from (
        select created_at from ${aiUsage}
        where user_id = ${userId} and feature = ${AiUsageFeature.CHAT} and created_at > ${since.toISOString()}
        union all
        select created_at from ${aiChatQuotaAttempts}
        where user_id = ${userId} and created_at > ${since.toISOString()}
      ) chat_activity
      order by created_at desc
      limit ${Math.max(limits.daily, limits.monthly)}
    `);
    return chatQuotaStatus(rows.map((row) => new Date(row.created_at_ms)), limits, now);
  }
}
