import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import {
  mentorshipProgramTemplates,
  type MentorshipProgramTemplateTask,
} from "../../../database/schema";

export type MentorshipTemplateRow = typeof mentorshipProgramTemplates.$inferSelect;

/**
 * The coach's saved weekly programs (SERVICE context, scoped by `coach_id` — the module's own
 * pattern, matching `mentorship_invite_codes`).
 *
 * Every method takes `coachId` and filters on it, including the delete: a template id alone must
 * never be enough to touch someone else's row.
 */
@Injectable()
export class MentorshipTemplateRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  listByCoach(coachId: string): Promise<MentorshipTemplateRow[]> {
    return withServiceContext(this.db, (tx) =>
      tx
        .select()
        .from(mentorshipProgramTemplates)
        .where(eq(mentorshipProgramTemplates.coachId, coachId))
        .orderBy(desc(mentorshipProgramTemplates.updatedAt)),
    );
  }

  /**
   * Save under a name, replacing whatever was there. `(coach_id, name)` is unique, so this IS the
   * edit path — there is no update endpoint.
   *
   * Returns `"QUOTA_FULL"` when a NEW name would cross the cap; overwriting an existing one always
   * fits, whatever the count.
   *
   * The count and the insert share a transaction but take no advisory lock, unlike
   * `MentorshipLinkRepository.acceptInvite`. There the quota is the ONLY abuse bound on an invite
   * code that deliberately has no use counter, so it had to be a real one; here it is a tidiness
   * ceiling on the coach's own list, and the worst a race can produce is a coach with 21 saved
   * weeks instead of 20. Add the lock if that ever costs anything.
   */
  upsert(
    coachId: string,
    name: string,
    examType: string | null,
    tasks: MentorshipProgramTemplateTask[],
    maxTemplates: number,
  ): Promise<MentorshipTemplateRow | "QUOTA_FULL"> {
    const now = new Date();
    return withServiceContext(this.db, async (tx) => {
      const existing = await tx
        .select({ id: mentorshipProgramTemplates.id })
        .from(mentorshipProgramTemplates)
        .where(
          and(
            eq(mentorshipProgramTemplates.coachId, coachId),
            eq(mentorshipProgramTemplates.name, name),
          ),
        )
        .limit(1);
      if (existing.length === 0) {
        const totals = await tx
          .select({ n: count() })
          .from(mentorshipProgramTemplates)
          .where(eq(mentorshipProgramTemplates.coachId, coachId));
        if ((totals[0]?.n ?? 0) >= maxTemplates) return "QUOTA_FULL";
      }

      const rows = await tx
        .insert(mentorshipProgramTemplates)
        .values({ coachId, name, examType, tasks })
        .onConflictDoUpdate({
          target: [mentorshipProgramTemplates.coachId, mentorshipProgramTemplates.name],
          set: { examType, tasks, updatedAt: now },
        })
        .returning();
      return rows[0]!;
    });
  }

  /** Returns false when the id is not this coach's — the caller turns that into a 404. */
  async deleteOwned(coachId: string, templateId: string): Promise<boolean> {
    return withServiceContext(this.db, async (tx) => {
      const deleted = await tx
        .delete(mentorshipProgramTemplates)
        .where(
          and(
            eq(mentorshipProgramTemplates.id, templateId),
            eq(mentorshipProgramTemplates.coachId, coachId),
          ),
        )
        .returning({ id: mentorshipProgramTemplates.id });
      return deleted.length > 0;
    });
  }

  /**
   * KVKK erasure. Explicit rather than relying on the `users` FK cascade, because erasure
   * ANONYMIZES the user row instead of deleting it, so no cascade ever fires.
   */
  async purgeForCoach(coachId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx
        .delete(mentorshipProgramTemplates)
        .where(eq(mentorshipProgramTemplates.coachId, coachId));
    });
  }
}
