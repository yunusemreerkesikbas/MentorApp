import { Injectable } from "@nestjs/common";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { userNotifications } from "../../../database/schema";
import type { NotificationCategory } from "@mentor/types";

export const NOTIFICATION_PAGE_SIZE = 30;

export type UserNotificationRow = typeof userNotifications.$inferSelect;

@Injectable()
export class UserNotificationRepository {
  async create(
    tx: DatabaseTx,
    data: {
      userId: string;
      category: NotificationCategory;
      title: string;
      body: string;
    },
  ): Promise<UserNotificationRow> {
    const rows = await tx.insert(userNotifications).values(data).returning();
    return rows[0]!;
  }

  async listByUser(
    tx: DatabaseTx,
    userId: string,
    category: NotificationCategory | undefined,
    page: number,
  ): Promise<UserNotificationRow[]> {
    const offset = (page - 1) * NOTIFICATION_PAGE_SIZE;
    const conditions = category
      ? [eq(userNotifications.userId, userId), eq(userNotifications.category, category)]
      : [eq(userNotifications.userId, userId)];

    return tx
      .select()
      .from(userNotifications)
      .where(and(...conditions))
      .orderBy(sql`${userNotifications.createdAt} DESC`)
      .limit(NOTIFICATION_PAGE_SIZE + 1) // +1 to detect hasMore
      .offset(offset);
  }

  async countUnread(tx: DatabaseTx, userId: string): Promise<number> {
    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(userNotifications)
      .where(and(eq(userNotifications.userId, userId), isNull(userNotifications.readAt)));
    return rows[0]?.count ?? 0;
  }

  async markRead(
    tx: DatabaseTx,
    userId: string,
    id: string,
  ): Promise<UserNotificationRow | null> {
    const now = new Date();
    const rows = await tx
      .update(userNotifications)
      .set({ readAt: now })
      .where(
        and(
          eq(userNotifications.id, id),
          eq(userNotifications.userId, userId),
          isNull(userNotifications.readAt),
        ),
      )
      .returning();
    return rows[0] ?? null;
  }

  async markAllRead(tx: DatabaseTx, userId: string): Promise<void> {
    const now = new Date();
    await tx
      .update(userNotifications)
      .set({ readAt: now })
      .where(and(eq(userNotifications.userId, userId), isNull(userNotifications.readAt)));
  }

  // ponytail: purge older than 90 days — backlog, not MVP
  async deleteOlderThan(tx: DatabaseTx, userId: string, before: Date): Promise<void> {
    await tx
      .delete(userNotifications)
      .where(and(eq(userNotifications.userId, userId), lt(userNotifications.createdAt, before)));
  }
}
