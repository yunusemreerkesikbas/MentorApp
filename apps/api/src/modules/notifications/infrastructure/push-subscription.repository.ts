import { HttpStatus, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { DatabaseTx } from "../../../database/drizzle";
import { pushSubscriptions } from "../../../database/schema";

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;

@Injectable()
export class PushSubscriptionRepository {
  async upsertWithinLimit(
    tx: DatabaseTx, userId: string,
    data: { endpoint: string; p256dh: string; auth: string }, maxSubscriptions: number,
  ): Promise<PushSubscriptionRow> {
    // Serialize a user's check + insert, including the first subscription where no row exists.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`push-subscriptions:${userId}`}, 0))`);
    const subscriptions = await this.listByUserId(tx, userId);
    if (!subscriptions.some((sub) => sub.endpoint === data.endpoint) && subscriptions.length >= maxSubscriptions) {
      throw new DomainError(ErrorCode.NOTIFICATIONS_PUSH_SUBSCRIPTION_LIMIT, HttpStatus.CONFLICT);
    }
    return this.upsert(tx, userId, data);
  }

  async upsert(
    tx: DatabaseTx,
    userId: string,
    data: { endpoint: string; p256dh: string; auth: string },
  ): Promise<PushSubscriptionRow> {
    const rows = await tx
      .insert(pushSubscriptions)
      .values({ userId, ...data })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, p256dh: data.p256dh, auth: data.auth },
      })
      .returning();
    return rows[0]!;
  }

  async deleteByEndpoint(tx: DatabaseTx, userId: string, endpoint: string): Promise<void> {
    await tx
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  }

  async listByUserId(tx: DatabaseTx, userId: string): Promise<PushSubscriptionRow[]> {
    return tx.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }
}
