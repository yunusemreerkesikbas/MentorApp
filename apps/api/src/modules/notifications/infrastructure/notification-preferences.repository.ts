import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { notificationPreferences } from "../../../database/schema";

export type NotificationPreferencesRow = typeof notificationPreferences.$inferSelect;

@Injectable()
export class NotificationPreferencesRepository {
  async getOrCreate(tx: DatabaseTx, userId: string): Promise<NotificationPreferencesRow> {
    const existing = await tx
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);
    if (existing[0]) return existing[0];

    const rows = await tx
      .insert(notificationPreferences)
      .values({ userId })
      .returning();
    return rows[0]!;
  }

  async update(
    tx: DatabaseTx,
    userId: string,
    patch: Partial<Pick<NotificationPreferencesRow, "emailEnabled" | "pushEnabled">>,
  ): Promise<NotificationPreferencesRow> {
    await this.getOrCreate(tx, userId);
    const rows = await tx
      .update(notificationPreferences)
      .set(patch)
      .where(eq(notificationPreferences.userId, userId))
      .returning();
    return rows[0]!;
  }

  async findByUserIdService(
    tx: DatabaseTx,
    userId: string,
  ): Promise<NotificationPreferencesRow | undefined> {
    const rows = await tx
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);
    return rows[0];
  }
}
