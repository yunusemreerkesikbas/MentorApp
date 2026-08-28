import { Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { announcements } from "../../../database/schema";
import type { AnnouncementAudience } from "@mentor/types";

export const ANNOUNCEMENT_PAGE_SIZE = 30;

export type AnnouncementRow = typeof announcements.$inferSelect;

@Injectable()
export class AnnouncementRepository {
  async create(
    tx: DatabaseTx,
    data: {
      title: string;
      body: string;
      linkUrl?: string;
      audience: AnnouncementAudience;
      createdBy: string;
    },
  ): Promise<AnnouncementRow> {
    const rows = await tx
      .insert(announcements)
      .values({ ...data, audience: data.audience as unknown as Record<string, unknown> })
      .returning();
    return rows[0]!;
  }

  async findById(tx: DatabaseTx, id: string): Promise<AnnouncementRow | null> {
    const rows = await tx.select().from(announcements).where(eq(announcements.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async list(tx: DatabaseTx, page: number): Promise<AnnouncementRow[]> {
    return tx
      .select()
      .from(announcements)
      .orderBy(desc(announcements.createdAt))
      .limit(ANNOUNCEMENT_PAGE_SIZE)
      .offset((page - 1) * ANNOUNCEMENT_PAGE_SIZE);
  }

  /**
   * DRAFT → SENDING, returning the row only when the transition actually happened. The status
   * predicate is the concurrency belt: two admins hitting "send" at once produce one job.
   */
  async markSending(
    tx: DatabaseTx,
    id: string,
    scheduledAt: Date | null,
  ): Promise<AnnouncementRow | null> {
    const rows = await tx
      .update(announcements)
      .set({ status: "SENDING", scheduledAt, updatedAt: new Date() })
      .where(and(eq(announcements.id, id), eq(announcements.status, "DRAFT")))
      .returning();
    return rows[0] ?? null;
  }

  /** Accumulates across fan-out batches; the final batch flips the row to SENT. */
  async addRecipients(tx: DatabaseTx, id: string, delta: number): Promise<void> {
    if (delta === 0) return;
    await tx
      .update(announcements)
      .set({ recipientCount: sql`${announcements.recipientCount} + ${delta}`, updatedAt: new Date() })
      .where(eq(announcements.id, id));
  }

  async markSent(tx: DatabaseTx, id: string): Promise<void> {
    await tx
      .update(announcements)
      .set({ status: "SENT", sentAt: new Date(), updatedAt: new Date() })
      .where(eq(announcements.id, id));
  }

  /** Only DRAFTs are deletable — a sent broadcast already lives in users' inboxes. */
  async deleteDraft(tx: DatabaseTx, id: string): Promise<boolean> {
    const rows = await tx
      .delete(announcements)
      .where(and(eq(announcements.id, id), eq(announcements.status, "DRAFT")))
      .returning({ id: announcements.id });
    return rows.length > 0;
  }
}
