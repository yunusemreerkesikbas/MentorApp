import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { pushSubscriptions } from "../../../database/schema";

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;

@Injectable()
export class PushSubscriptionRepository {
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
