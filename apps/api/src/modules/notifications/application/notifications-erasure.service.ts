import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import {
  notificationDeliveries,
  notificationPreferences,
  pushSubscriptions,
  userNotifications,
} from "../../../database/schema";

/**
 * KVKK erasure for notifications (WP-K): push endpoints, preferences, delivery dedup log, and the
 * in-app inbox are all user-scoped device/behavior data — hard-deleted in one SERVICE-ctx tx.
 * Idempotent (deletes are no-ops on a second run).
 */
@Injectable()
export class NotificationsErasureService {
  private readonly logger = new Logger(NotificationsErasureService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async eraseUserData(userId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
      await tx.delete(notificationPreferences).where(eq(notificationPreferences.userId, userId));
      await tx.delete(notificationDeliveries).where(eq(notificationDeliveries.userId, userId));
      await tx.delete(userNotifications).where(eq(userNotifications.userId, userId));
    });
    this.logger.log(`Notification data erased for user ${userId}`);
  }
}
