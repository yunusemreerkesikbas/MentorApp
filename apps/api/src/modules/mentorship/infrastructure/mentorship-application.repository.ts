import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import type { MentorshipClaimId } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { mentorshipCoachApplications } from "../../../database/schema";

export type MentorshipApplicationRow = typeof mentorshipCoachApplications.$inferSelect;

/** The coach's own columns. The admin's are absent by construction — see the table comment. */
export interface ApplicantFields {
  headline: string;
  bio: string;
  institution: string | null;
  branch: string | null;
  years: number | null;
  note: string | null;
}

/**
 * Coach-registry persistence (table name predates APP-089 — see the schema comment).
 *
 * SERVICE context throughout, like the rest of W8: `mentorship_coach_applications` carries no RLS
 * policy of its own, and every read here is either scoped by an explicit `userId` or is an admin
 * registry read whose caller is gated by `@Roles(SUPER_ADMIN)`.
 */
@Injectable()
export class MentorshipApplicationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  findByUser(userId: string): Promise<MentorshipApplicationRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(mentorshipCoachApplications)
        .where(eq(mentorshipCoachApplications.userId, userId))
        .limit(1);
      return rows[0];
    });
  }

  /* `findById` is gone (APP-089): admin used to address an application row, and now addresses the
     PERSON — there is no request to point at, and `UNIQUE (user_id)` makes `findByUser` the only
     lookup anybody needs. */

  /**
   * Register as a coach. Returns undefined when a row already exists.
   *
   * `DO NOTHING` rather than the upsert this used to be, and the difference is the whole APP-089
   * change. Re-applying used to revive a REJECTED row, so the statement had to overwrite one; now
   * registration writes an ACTIVE row, which means overwriting ANY existing row would hand the
   * person an admin's decision to erase. `canRegister` already refuses every one of those, and this
   * is the same refusal expressed where a race cannot get past it.
   */
  async register(
    userId: string,
    fields: ApplicantFields,
    now = new Date(),
  ): Promise<MentorshipApplicationRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .insert(mentorshipCoachApplications)
        .values({
          userId,
          status: "ACTIVE",
          headline: fields.headline,
          bio: fields.bio,
          claimInstitution: fields.institution,
          claimBranch: fields.branch,
          claimYears: fields.years,
          claimNote: fields.note,
          submittedAt: now,
        })
        .onConflictDoNothing({ target: mentorshipCoachApplications.userId })
        .returning();
      return rows[0];
    });
  }

  /**
   * An admin moving a coach's standing. Undefined when there is no registry row.
   *
   * Unscoped by current status on purpose: every transition is legal (a suspended coach can be
   * reinstated, an active one pulled back), and a status write is idempotent, so a retried call
   * lands on the same row with the same value. `verifiedClaims` is deliberately NOT touched —
   * reinstating somebody must not silently re-assert badges nobody re-read.
   */
  async setStatus(
    userId: string,
    verdict: { status: string; reviewNote: string | null; reviewedBy: string },
    now = new Date(),
  ): Promise<MentorshipApplicationRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(mentorshipCoachApplications)
        .set({
          status: verdict.status,
          reviewNote: verdict.reviewNote,
          reviewedBy: verdict.reviewedBy,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(eq(mentorshipCoachApplications.userId, userId))
        .returning();
      return rows[0];
    });
  }

  /** An admin marking which claims they checked. Standing is untouched: the two are separate acts. */
  async setVerifiedClaims(
    userId: string,
    verifiedClaims: MentorshipClaimId[],
    reviewedBy: string,
    now = new Date(),
  ): Promise<MentorshipApplicationRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(mentorshipCoachApplications)
        .set({ verifiedClaims, reviewedBy, reviewedAt: now, updatedAt: now })
        .where(eq(mentorshipCoachApplications.userId, userId))
        .returning();
      return rows[0];
    });
  }

  /**
   * The coach editing their own two student-facing lines.
   *
   * Scoped to ACTIVE so a suspended coach cannot keep polishing the profile a student would read,
   * and so somebody an admin is mid-review on cannot rewrite what is being reviewed. The claims are
   * untouched: they are what an admin may have checked.
   */
  async updateProfile(
    userId: string,
    fields: { headline: string; bio: string },
    now = new Date(),
  ): Promise<MentorshipApplicationRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(mentorshipCoachApplications)
        .set({ headline: fields.headline, bio: fields.bio, updatedAt: now })
        .where(
          and(
            eq(mentorshipCoachApplications.userId, userId),
            eq(mentorshipCoachApplications.status, "ACTIVE"),
          ),
        )
        .returning();
      return rows[0];
    });
  }

  /** The registry, filtered to one standing, oldest first. */
  listByStatus(status: string, limit: number): Promise<MentorshipApplicationRow[]> {
    return withServiceContext(this.db, (tx) =>
      tx
        .select()
        .from(mentorshipCoachApplications)
        .where(eq(mentorshipCoachApplications.status, status))
        .orderBy(asc(mentorshipCoachApplications.submittedAt))
        .limit(limit),
    );
  }

  /**
   * KVKK. The FK cascade cannot be relied on: erasure ANONYMIZES the `users` row rather than
   * deleting it, so `ON DELETE CASCADE` never fires — the same trap `mentorship_program_templates`
   * documents. An application is the person's own account of themselves; it goes with them.
   */
  purgeForUser(userId: string): Promise<void> {
    return withServiceContext(this.db, async (tx) => {
      await tx
        .delete(mentorshipCoachApplications)
        .where(eq(mentorshipCoachApplications.userId, userId));
    });
  }
}
