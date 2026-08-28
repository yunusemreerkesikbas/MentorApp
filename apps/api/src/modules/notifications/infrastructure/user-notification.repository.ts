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
      linkUrl?: string;
      dedupeKey?: string;
      data?: Record<string, unknown>;
    },
  ): Promise<UserNotificationRow | null> {
    const rows = await tx
      .insert(userNotifications)
      .values(data)
      .onConflictDoNothing()
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Bulk insert for broadcast fan-out. `onConflictDoNothing` leans on the partial unique index
   * on (user_id, dedupe_key), so a retried dispatch job silently skips already-notified users.
   * Returns the rows that were actually created (i.e. who to ping over SSE).
   */
  async createMany(
    tx: DatabaseTx,
    rows: Array<{
      userId: string;
      category: NotificationCategory;
      title: string;
      body: string;
      linkUrl?: string;
      dedupeKey?: string;
      data?: Record<string, unknown>;
    }>,
  ): Promise<UserNotificationRow[]> {
    if (rows.length === 0) return [];
    return tx.insert(userNotifications).values(rows).onConflictDoNothing().returning();
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

  async markUnread(tx: DatabaseTx, userId: string, id: string): Promise<UserNotificationRow | null> {
    const rows = await tx
      .update(userNotifications)
      .set({ readAt: null })
      .where(and(eq(userNotifications.id, id), eq(userNotifications.userId, userId)))
      .returning();
    return rows[0] ?? null;
  }

  async delete(tx: DatabaseTx, userId: string, id: string): Promise<void> {
    await tx
      .delete(userNotifications)
      .where(and(eq(userNotifications.id, id), eq(userNotifications.userId, userId)));
  }

  // ponytail: purge older than 90 days — backlog, not MVP
  async deleteOlderThan(tx: DatabaseTx, userId: string, before: Date): Promise<void> {
    await tx
      .delete(userNotifications)
      .where(and(eq(userNotifications.userId, userId), lt(userNotifications.createdAt, before)));
  }
}
