import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, lt } from "drizzle-orm";
import type { ModerationTargetType } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { forumAttachments, forumPendingAttachments } from "../../../database/schema";

export type AttachmentRow = typeof forumAttachments.$inferSelect;

export interface NewAttachment {
  kind: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  fileName: string | null;
  width: number | null;
  height: number | null;
}

/**
 * Forum post attachments (APP-018). Polymorphic target (THREAD | POST). Writes run in SERVICE context
 * (trusted, mirrors the other forum repos); reads are batched to avoid N+1 across a feed page.
 */
@Injectable()
export class ForumAttachmentRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Bulk-insert a post's attachments in upload order (position = array index). Returns the rows.
   * Consumes the keys' pending-ledger rows in the same tx so they aren't swept as orphans later. */
  async insertMany(
    targetType: ModerationTargetType,
    targetId: string,
    authorId: string,
    items: NewAttachment[],
  ): Promise<AttachmentRow[]> {
    if (items.length === 0) return [];
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .insert(forumAttachments)
        .values(
          items.map((a, i) => ({
            targetType,
            targetId,
            authorId,
            kind: a.kind,
            storageKey: a.storageKey,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            fileName: a.fileName,
            width: a.width,
            height: a.height,
            position: i,
          })),
        )
        .returning();
      await tx.delete(forumPendingAttachments).where(
        inArray(
          forumPendingAttachments.storageKey,
          items.map((a) => a.storageKey),
        ),
      );
      return rows;
    });
  }

  /** Record a freshly minted upload key as pending (idempotent) — the orphan-cleanup source of truth. */
  async markPending(storageKey: string, authorId: string): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx.insert(forumPendingAttachments).values({ storageKey, authorId }).onConflictDoNothing(),
    );
  }

  /** Pending keys minted before `cutoff` (i.e. never attached) — orphaned uploads to sweep. */
  async listExpiredPending(cutoff: Date, limit: number): Promise<string[]> {
    const rows = await withServiceContext(this.db, (tx) =>
      tx
        .select({ storageKey: forumPendingAttachments.storageKey })
        .from(forumPendingAttachments)
        .where(lt(forumPendingAttachments.createdAt, cutoff))
        .orderBy(asc(forumPendingAttachments.createdAt))
        .limit(limit),
    );
    return rows.map((r) => r.storageKey);
  }

  /** Drop pending-ledger rows by key (after their storage objects are deleted). */
  async deletePending(storageKeys: string[]): Promise<void> {
    if (storageKeys.length === 0) return;
    await withServiceContext(this.db, (tx) =>
      tx.delete(forumPendingAttachments).where(inArray(forumPendingAttachments.storageKey, storageKeys)),
    );
  }

  /** Attachments for a set of targets → `targetId → rows[]` (ordered by position). Empty ids → empty map. */
  async listForTargets(
    targetType: ModerationTargetType,
    targetIds: string[],
  ): Promise<Map<string, AttachmentRow[]>> {
    const map = new Map<string, AttachmentRow[]>();
    if (targetIds.length === 0) return map;
    const rows = await withServiceContext(this.db, (tx) =>
      tx
        .select()
        .from(forumAttachments)
        .where(
          and(
            eq(forumAttachments.targetType, targetType),
            inArray(forumAttachments.targetId, targetIds),
          ),
        )
        .orderBy(asc(forumAttachments.targetId), asc(forumAttachments.position)),
    );
    for (const r of rows) {
      const list = map.get(r.targetId) ?? [];
      list.push(r);
      map.set(r.targetId, list);
    }
    return map;
  }
}
