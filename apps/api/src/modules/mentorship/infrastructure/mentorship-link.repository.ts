import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, or, sql } from "drizzle-orm";
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

  /**
   * One link by id — resolving `plan_tasks.origin_ref_id`, which is a soft ref with no FK, so the
   * row it points at may already be gone (erasure) or no longer ACTIVE. Callers check `status`.
   */
  findById(linkId: string): Promise<MentorshipLinkRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(coachStudents)
        .where(eq(coachStudents.id, linkId))
        .limit(1);
      return rows[0];
    });
  }

  /**
   * Every live coach↔student pair, for the daily risk digest.
   *
   * Deliberately unpaged: the digest evaluates the whole population once a day and one batch
   * snapshot call covers it. Two ids per row, no identity or behavioural data — the caller resolves
   * both through their own module's seams.
   */
  listAllActiveLinks(): Promise<{ coachId: string; studentId: string }[]> {
    return withServiceContext(this.db, (tx) =>
      tx
        .select({ coachId: coachStudents.coachId, studentId: coachStudents.studentId })
        .from(coachStudents)
        .where(eq(coachStudents.status, "ACTIVE")),
    );
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
   *
   * The quota check lives INSIDE this transaction, behind an advisory lock on the coach. Checking
   * it in the service first would be check-then-act: two students redeeming the same code at once
   * would both read a count below the cap and both get in. Since the invite code has no use
   * counter of its own, the quota is the only bound it has, so it has to be a real one.
   *
   * The `coach_students_pair_idx` unique makes a plain insert fail on a re-link, so this upserts.
   * Returns `"QUOTA_FULL"` when the cap is reached and `"ALREADY_ACTIVE"` when `setWhere` skipped
   * the update (a row exists that is not ENDED).
   */
  acceptInvite(
    coachId: string,
    studentId: string,
    maxActiveStudents: number,
  ): Promise<MentorshipLinkRow | "QUOTA_FULL" | "ALREADY_ACTIVE"> {
    const now = new Date();
    return withServiceContext(this.db, async (tx) => {
      // Serialize concurrent redemptions of one coach's code; released at commit.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${"mentorship:coach:" + coachId}, 0))`,
      );
      const active = await tx
        .select({ n: count() })
        .from(coachStudents)
        .where(and(eq(coachStudents.coachId, coachId), eq(coachStudents.status, "ACTIVE")));
      if ((active[0]?.n ?? 0) >= maxActiveStudents) return "QUOTA_FULL";

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
      return rows[0] ?? "ALREADY_ACTIVE";
    });
  }

  /** ACTIVE → ENDED (idempotent). Returns the row only if this call performed the transition. */
  end(linkId: string, endedBy: string): Promise<MentorshipLinkRow | undefined> {
    const now = new Date();
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(coachStudents)
        // The note goes with the link. Re-linking revives this very row (`onConflictDoUpdate`
        // with `setWhere: status = 'ENDED'`), so a note left behind would resurface months later.
        .set({
          status: "ENDED",
          endedAt: now,
          endedBy,
          coachNote: null,
          coachNoteAt: null,
          updatedAt: now,
        })
        .where(and(eq(coachStudents.id, linkId), eq(coachStudents.status, "ACTIVE")))
        .returning();
      return rows[0];
    });
  }

  /** The coach's standing note. `null` clears it; one row per link, overwritten in place. */
  setCoachNote(linkId: string, body: string | null): Promise<MentorshipLinkRow | undefined> {
    const now = new Date();
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(coachStudents)
        .set({ coachNote: body, coachNoteAt: body === null ? null : now, updatedAt: now })
        .where(and(eq(coachStudents.id, linkId), eq(coachStudents.status, "ACTIVE")))
        .returning();
      return rows[0];
    });
  }

  /**
   * KVKK erasure: drop every link the user is part of, and blank an `ended_by` that points at them
   * (erasure anonymizes the `users` row rather than deleting it, so no FK cascade fires).
   */
  async purgeForUser(userId: string): Promise<string[]> {
    return withServiceContext(this.db, async (tx) => {
      await tx.update(coachStudents).set({ endedBy: null }).where(eq(coachStudents.endedBy, userId));
      const deleted = await tx
        .delete(coachStudents)
        .where(or(eq(coachStudents.coachId, userId), eq(coachStudents.studentId, userId)))
        .returning({ id: coachStudents.id });
      return deleted.map((row) => row.id);
    });
  }
}
