import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { notificationDeliveries } from "../../../database/schema";

@Injectable()
export class NotificationDeliveryRepository {
  async exists(tx: DatabaseTx, data: {
    userId: string; channel: string; template: string; dedupeKey: string;
  }): Promise<boolean> {
    const rows = await tx.select({ id: notificationDeliveries.id }).from(notificationDeliveries)
      .where(and(eq(notificationDeliveries.userId, data.userId), eq(notificationDeliveries.channel, data.channel),
        eq(notificationDeliveries.template, data.template), eq(notificationDeliveries.dedupeKey, data.dedupeKey)))
      .limit(1);
    return rows.length > 0;
  }

  /** Returns true if inserted (first delivery); false if dedupe hit. */
  async tryRecord(
    tx: DatabaseTx,
    data: {
      userId: string;
      channel: string;
      template: string;
      dedupeKey: string;
    },
  ): Promise<boolean> {
    const rows = await tx
      .insert(notificationDeliveries)
      .values(data)
      .onConflictDoNothing({
        target: [
          notificationDeliveries.userId,
          notificationDeliveries.channel,
          notificationDeliveries.template,
          notificationDeliveries.dedupeKey,
        ],
      })
      .returning({ id: notificationDeliveries.id });
    return rows.length > 0;
  }

  async release(
    tx: DatabaseTx,
    data: {
      userId: string;
      channel: string;
      template: string;
      dedupeKey: string;
    },
  ): Promise<void> {
    await tx
      .delete(notificationDeliveries)
      .where(
        and(
          eq(notificationDeliveries.userId, data.userId),
          eq(notificationDeliveries.channel, data.channel),
          eq(notificationDeliveries.template, data.template),
          eq(notificationDeliveries.dedupeKey, data.dedupeKey),
        ),
      );
  }
}
