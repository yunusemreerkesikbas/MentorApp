import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { ModerationTargetType } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { forumAttachments } from "../../../database/schema";

export type AttachmentRow = typeof forumAttachments.$inferSelect;

export interface NewAttachment {
  kind: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
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

  /** Bulk-insert a post's attachments in upload order (position = array index). Returns the rows. */
  async insertMany(
    targetType: ModerationTargetType,
    targetId: string,
    authorId: string,
    items: NewAttachment[],
  ): Promise<AttachmentRow[]> {
    if (items.length === 0) return [];
    return withServiceContext(this.db, (tx) =>
      tx
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
            width: a.width,
            height: a.height,
            position: i,
          })),
        )
        .returning(),
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
