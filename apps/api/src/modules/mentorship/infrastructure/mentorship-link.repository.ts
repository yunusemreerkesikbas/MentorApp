import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, or } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { coachStudents } from "../../../database/schema";

export type MentorshipLinkRow = typeof coachStudents.$inferSelect;

/**
 * Coach↔student link persistence.
 *
 * SERVICE context throughout: this is a cross-user relation with no RLS policy (the `buddy_pairs` /
 * `study_room_members` pattern). Every read is scoped by an explicit `coachId` / `studentId`
 * predicate here, and callers must pass through `MentorshipLinkService.requireActiveLink` first.
 */
@Injectable()
export class MentorshipLinkRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  findActive(coachId: string, studentId: string): Promise<MentorshipLinkRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(coachStudents)
        .where(
          and(
            eq(coachStudents.coachId, coachId),
            eq(coachStudents.studentId, studentId),
            eq(coachStudents.status, "ACTIVE"),
          ),
        )
        .limit(1);
      return rows[0];
    });
  }

  findById(linkId: string): Promise<MentorshipLinkRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.select().from(coachStudents).where(eq(coachStudents.id, linkId)).limit(1);
      return rows[0];
    });
  }

  /** The student's current coach, if any. The partial unique index guarantees at most one. */
  findActiveByStudent(studentId: string): Promise<MentorshipLinkRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(coachStudents)
        .where(and(eq(coachStudents.studentId, studentId), eq(coachStudents.status, "ACTIVE")))
        .limit(1);
      return rows[0];
    });
  }

  countActiveByCoach(coachId: string): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ n: count() })
        .from(coachStudents)
        .where(and(eq(coachStudents.coachId, coachId), eq(coachStudents.status, "ACTIVE")));
      return rows[0]?.n ?? 0;
    });
  }

  async listByCoach(
    coachId: string,
    status: string,
    page: number,
    pageSize: number,
  ): Promise<{ rows: MentorshipLinkRow[]; total: number }> {
    return withServiceContext(this.db, async (tx) => {
      const where = and(eq(coachStudents.coachId, coachId), eq(coachStudents.status, status));
      const rows = await tx
        .select()
        .from(coachStudents)
        .where(where)
        .orderBy(desc(coachStudents.acceptedAt), desc(coachStudents.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
      const totals = await tx.select({ n: count() }).from(coachStudents).where(where);
      return { rows, total: totals[0]?.n ?? 0 };
    });
  }

  /**
   * Accept an invite: create the ACTIVE link, or revive an ENDED one between the same pair.
   * The `coach_students_pair_idx` unique makes a plain insert fail on a re-link, so this upserts.
   * Returns undefined when the partial unique index rejects a second active coach (race-safe).
   */
  acceptInvite(coachId: string, studentId: string): Promise<MentorshipLinkRow | undefined> {
    const now = new Date();
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .insert(coachStudents)
        .values({ coachId, studentId, status: "ACTIVE", source: "INVITE", acceptedAt: now })
        .onConflictDoUpdate({
          target: [coachStudents.coachId, coachStudents.studentId],
          set: { status: "ACTIVE", acceptedAt: now, endedAt: null, endedBy: null, updatedAt: now },
          // Only a dormant link may be revived; an already-ACTIVE row is left untouched so the
          // caller's ALREADY_LINKED check stays authoritative.
          setWhere: eq(coachStudents.status, "ENDED"),
        })
        .returning();
      return rows[0];
    });
  }

  /** ACTIVE → ENDED (idempotent). Returns the row only if this call performed the transition. */
  end(linkId: string, endedBy: string): Promise<MentorshipLinkRow | undefined> {
    const now = new Date();
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(coachStudents)
        .set({ status: "ENDED", endedAt: now, endedBy, updatedAt: now })
        .where(and(eq(coachStudents.id, linkId), eq(coachStudents.status, "ACTIVE")))
        .returning();
      return rows[0];
    });
  }

  /**
   * KVKK erasure: drop every link the user is part of, and blank an `ended_by` that points at them
   * (erasure anonymizes the `users` row rather than deleting it, so no FK cascade fires).
   */
  async purgeForUser(userId: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.update(coachStudents).set({ endedBy: null }).where(eq(coachStudents.endedBy, userId));
      await tx
        .delete(coachStudents)
        .where(or(eq(coachStudents.coachId, userId), eq(coachStudents.studentId, userId)));
    });
  }
}
