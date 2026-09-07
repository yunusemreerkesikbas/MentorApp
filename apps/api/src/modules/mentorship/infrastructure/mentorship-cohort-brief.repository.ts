import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import {
  mentorshipCohortBriefs,
  type MentorshipCohortBriefItem,
} from "../../../database/schema";

export type MentorshipCohortBriefRow = typeof mentorshipCohortBriefs.$inferSelect;

/**
 * The coach's stored cohort brief (SERVICE context, keyed by `coach_id` — the module's own pattern,
 * matching `mentorship_invite_codes`).
 *
 * One row per coach, overwritten in place. There is no list method and no id parameter: a coach id
 * is the only way in, so a brief written for one coach cannot be addressed by another.
 */
@Injectable()
export class MentorshipCohortBriefRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async find(coachId: string): Promise<MentorshipCohortBriefRow | null> {
    const [row] = await withServiceContext(this.db, (tx) =>
      tx
        .select()
        .from(mentorshipCohortBriefs)
        .where(eq(mentorshipCohortBriefs.coachId, coachId))
        .limit(1),
    );
    return row ?? null;
  }

  /**
   * Write this morning's brief over yesterday's.
   *
   * `generatedAt` is set explicitly rather than left to the column default, because the caller
   * returns the same timestamp to the client and reading it back would cost a second round trip
   * for a value we already decided.
   */
  async upsert(
    coachId: string,
    brief: { overall: string; items: MentorshipCohortBriefItem[] },
    fingerprint: string,
    pairs: string[],
    generatedAt: Date,
  ): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx
        .insert(mentorshipCohortBriefs)
        .values({ coachId, brief, fingerprint, pairs, generatedAt })
        .onConflictDoUpdate({
          target: mentorshipCohortBriefs.coachId,
          set: { brief, fingerprint, pairs, generatedAt },
        }),
    );
  }

  /**
   * KVKK. Erasure anonymizes `users` instead of deleting them, so the `ON DELETE CASCADE` on
   * `coach_id` never fires — the same trap `mentorship_program_templates` and
   * `mentorship_coach_applications` carry, and the reason this method exists at all.
   */
  async purgeForCoach(coachId: string): Promise<void> {
    await withServiceContext(this.db, (tx) =>
      tx.delete(mentorshipCohortBriefs).where(eq(mentorshipCohortBriefs.coachId, coachId)),
    );
  }
}
