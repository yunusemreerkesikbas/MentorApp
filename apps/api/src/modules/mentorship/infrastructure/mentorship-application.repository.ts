import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import type { MentorshipClaimId } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { mentorshipCoachApplications } from "../../../database/schema";

export type MentorshipApplicationRow = typeof mentorshipCoachApplications.$inferSelect;

/** The applicant's own columns. The admin's are absent by construction — see the table comment. */
export interface ApplicantFields {
  headline: string;
  bio: string;
  institution: string | null;
  branch: string | null;
  years: number | null;
  note: string | null;
}

/**
 * Coach-application persistence.
 *
 * SERVICE context throughout, like the rest of W8: `mentorship_coach_applications` carries no RLS
 * policy of its own, and every read here is either scoped by an explicit `userId` or is an admin
 * queue read whose caller is gated by `@Roles(SUPER_ADMIN)`.
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

  findById(applicationId: string): Promise<MentorshipApplicationRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(mentorshipCoachApplications)
        .where(eq(mentorshipCoachApplications.id, applicationId))
        .limit(1);
      return rows[0];
    });
  }

  /**
   * Submit, or re-submit after a rejection.
   *
   * Upsert rather than insert because `UNIQUE (user_id)` makes a second row impossible and a
   * re-application is the same person's same application, refreshed — the `coach_students`
   * revival pattern. `setWhere` restricts it to REJECTED rows: whether the applicant is ALLOWED to
   * be here is the service's decision (`canApply`), but the database refuses to let a race
   * overwrite a PENDING or APPROVED row regardless of what the service concluded a moment ago.
   *
   * The verdict columns are reset with the same statement. A revived row keeping its old
   * `review_note` would show the applicant last time's refusal next to this time's submission.
   */
  async submit(
    userId: string,
    fields: ApplicantFields,
    now = new Date(),
  ): Promise<MentorshipApplicationRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .insert(mentorshipCoachApplications)
        .values({
          userId,
          status: "PENDING",
          headline: fields.headline,
          bio: fields.bio,
          claimInstitution: fields.institution,
          claimBranch: fields.branch,
          claimYears: fields.years,
          claimNote: fields.note,
          submittedAt: now,
        })
        .onConflictDoUpdate({
          target: mentorshipCoachApplications.userId,
          set: {
            status: "PENDING",
            headline: fields.headline,
            bio: fields.bio,
            claimInstitution: fields.institution,
            claimBranch: fields.branch,
            claimYears: fields.years,
            claimNote: fields.note,
            verifiedClaims: [],
            reviewedBy: null,
            reviewedAt: null,
            reviewNote: null,
            submittedAt: now,
            updatedAt: now,
          },
          setWhere: eq(mentorshipCoachApplications.status, "REJECTED"),
        })
        .returning();
      return rows[0];
    });
  }

  /**
   * Record a verdict. Returns undefined when the row is gone or already decided, which is what
   * makes the review endpoint safe to retry: the second call changes nothing and says so.
   */
  async review(
    applicationId: string,
    verdict: {
      status: "APPROVED" | "REJECTED";
      verifiedClaims: MentorshipClaimId[];
      reviewNote: string | null;
      reviewedBy: string;
    },
    now = new Date(),
  ): Promise<MentorshipApplicationRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(mentorshipCoachApplications)
        .set({
          status: verdict.status,
          verifiedClaims: verdict.verifiedClaims,
          reviewNote: verdict.reviewNote,
          reviewedBy: verdict.reviewedBy,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(mentorshipCoachApplications.id, applicationId),
            eq(mentorshipCoachApplications.status, "PENDING"),
          ),
        )
        .returning();
      return rows[0];
    });
  }

  /**
   * The coach editing their own two student-facing lines.
   *
   * Scoped to APPROVED so an outstanding application cannot be rewritten while somebody is reading
   * it, and so a rejected one cannot be quietly turned into a profile. The claims and the verdict
   * are untouched: they are what was vetted.
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
            eq(mentorshipCoachApplications.status, "APPROVED"),
          ),
        )
        .returning();
      return rows[0];
    });
  }

  /** The queue: one status, oldest first — the order a queue is worked in. */
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
