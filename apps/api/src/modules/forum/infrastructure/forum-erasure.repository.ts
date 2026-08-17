import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import {
  forumAttachments,
  forumBookmarks,
  forumPosts,
  forumPollVotes,
  forumReactions,
  forumReports,
  forumTagSuggestions,
  forumThreads,
  forumZoneMembers,
} from "../../../database/schema";

/** Free text is redacted in place — rows survive so other people's conversations stay coherent. */
export const REDACTED_FORUM_CONTENT = "[silinmiş içerik]";

/**
 * KVKK erasure for forum (WP-K). One SERVICE-ctx transaction (coaching-erasure precedent).
 *
 * Redacted in place: the user's threads (title+body) and posts (body) — hard-deleting them would
 * punch holes in other students' conversations and orphan accepted answers, so the rows stay and
 * only the personal text goes. `is_accepted` and counters keep their meaning.
 * Deleted: reactions, bookmarks, zone memberships, reports (as reporter), attachments.
 * Returns the attachment storage keys so the caller can delete the objects (best-effort, outside tx).
 */
@Injectable()
export class ForumErasureRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async eraseUserData(userId: string): Promise<{ attachmentStorageKeys: string[] }> {
    return withServiceContext(this.db, async (tx) => {
      // Collect the attachment objects before dropping their rows.
      const attachments = await tx
        .select({ storageKey: forumAttachments.storageKey })
        .from(forumAttachments)
        .where(eq(forumAttachments.authorId, userId));

      await tx.delete(forumAttachments).where(eq(forumAttachments.authorId, userId));
      await tx.delete(forumReactions).where(eq(forumReactions.userId, userId));
      await tx.delete(forumPollVotes).where(eq(forumPollVotes.userId, userId));
      await tx.delete(forumBookmarks).where(eq(forumBookmarks.userId, userId));
      await tx.delete(forumZoneMembers).where(eq(forumZoneMembers.userId, userId));
      await tx.delete(forumReports).where(eq(forumReports.reporterId, userId));
      await tx
        .update(forumTagSuggestions)
        .set({ suggestedBy: null })
        .where(eq(forumTagSuggestions.suggestedBy, userId));
      await tx
        .update(forumTagSuggestions)
        .set({ reviewedBy: null })
        .where(eq(forumTagSuggestions.reviewedBy, userId));

      await tx
        .update(forumThreads)
        .set({ title: REDACTED_FORUM_CONTENT, body: REDACTED_FORUM_CONTENT })
        .where(eq(forumThreads.authorId, userId));
      await tx
        .update(forumPosts)
        .set({ body: REDACTED_FORUM_CONTENT })
        .where(eq(forumPosts.authorId, userId));

      return { attachmentStorageKeys: attachments.map((a) => a.storageKey) };
    });
  }
}
