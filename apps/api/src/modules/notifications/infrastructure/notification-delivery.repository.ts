import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { notificationDeliveries } from "../../../database/schema";

@Injectable()
export class NotificationDeliveryRepository {
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
}
