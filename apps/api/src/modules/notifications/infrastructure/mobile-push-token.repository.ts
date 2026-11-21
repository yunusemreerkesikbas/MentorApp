import { HttpStatus, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import type { MobilePushPlatform } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { DatabaseTx } from "../../../database/drizzle";
import { mobilePushTokens } from "../../../database/schema-mobile-push";

export type MobilePushTokenRow = typeof mobilePushTokens.$inferSelect;

@Injectable()
export class MobilePushTokenRepository {
  async upsertWithinLimit(
    tx: DatabaseTx,
    userId: string,
    data: { token: string; platform: MobilePushPlatform },
    maxSubscriptions: number,
  ): Promise<MobilePushTokenRow> {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`mobile-push-tokens:${userId}`}, 0))`,
    );
    const existing = await this.listByUserId(tx, userId);
    if (!existing.some((row) => row.token === data.token) && existing.length >= maxSubscriptions) {
      throw new DomainError(ErrorCode.NOTIFICATIONS_PUSH_SUBSCRIPTION_LIMIT, HttpStatus.CONFLICT);
    }
    return this.upsert(tx, userId, data);
  }

  async upsert(
    tx: DatabaseTx,
    userId: string,
    data: { token: string; platform: MobilePushPlatform },
  ): Promise<MobilePushTokenRow> {
    const rows = await tx
      .insert(mobilePushTokens)
      .values({ userId, token: data.token, platform: data.platform })
      .onConflictDoUpdate({
        target: mobilePushTokens.token,
        set: { userId, platform: data.platform, updatedAt: new Date() },
      })
      .returning();
    return rows[0]!;
  }

  async deleteByToken(tx: DatabaseTx, userId: string, token: string): Promise<void> {
    await tx
      .delete(mobilePushTokens)
      .where(and(eq(mobilePushTokens.userId, userId), eq(mobilePushTokens.token, token)));
  }

  async listByUserId(tx: DatabaseTx, userId: string): Promise<MobilePushTokenRow[]> {
    return tx.select().from(mobilePushTokens).where(eq(mobilePushTokens.userId, userId));
  }
}
