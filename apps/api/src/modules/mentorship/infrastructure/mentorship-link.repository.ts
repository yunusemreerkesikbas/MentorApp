import { Inject, Injectable } from "@nestjs/common";
import { and, asc, count, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import {
  MentorshipSeat,
  type MentorshipRiskFlagId,
  type MentorshipSeatId,
} from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { coachStudents } from "../../../database/schema";

export type MentorshipLinkRow = typeof coachStudents.$inferSelect;

/** One live link plus the coach's mark on it — what the daily digest needs and nothing more. */
export interface ActiveLinkRow {
  coachId: string;
  studentId: string;
  attendedAt: Date | null;
  attendedFlags: string[] | null;
}

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

  lockActiveInTransaction(
    tx: DatabaseTx,
    coachId: string,
    studentIds: string[],
  ): Promise<MentorshipLinkRow[]> {
    if (studentIds.length === 0) return Promise.resolve([]);
    return tx
      .select()
      .from(coachStudents)
      .where(
        and(
          eq(coachStudents.coachId, coachId),
          inArray(coachStudents.studentId, studentIds),
          eq(coachStudents.status, "ACTIVE"),
        ),
      )
      .orderBy(asc(coachStudents.studentId))
      .for("update");
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
   * Every live coach↔student pair the coach can see, for the daily risk digest. A link waiting
   * for a seat is left out: it is frozen, and the morning email is the coach's window too.
   *
   * Deliberately unpaged: the digest evaluates the whole population once a day and one batch
   * snapshot call covers it. Two ids per row, no identity or behavioural data — the caller resolves
   * both through their own module's seams.
   */
  listAllActiveLinks(): Promise<ActiveLinkRow[]> {
    return withServiceContext(this.db, (tx) =>
      tx
        .select({
          coachId: coachStudents.coachId,
          studentId: coachStudents.studentId,
          // The digest reads the same mark the roster does — a student the coach handled must not
          // be named again in the morning email while a different one has news.
          attendedAt: coachStudents.attendedAt,
          attendedFlags: coachStudents.attendedFlags,
        })
        .from(coachStudents)
        .where(
          and(eq(coachStudents.status, "ACTIVE"), ne(coachStudents.seat, MentorshipSeat.NONE)),
        ),
    );
  }

  /**
   * Coaches whose seats a change to this user's subscription can move: their own (the user is a
   * coach whose plan changed) or their coach's (the user is a student who started or stopped
   * paying for themselves).
   */
  listCoachIdsTouching(userId: string): Promise<string[]> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .selectDistinct({ coachId: coachStudents.coachId })
        .from(coachStudents)
        .where(
          and(
            eq(coachStudents.status, "ACTIVE"),
            or(eq(coachStudents.coachId, userId), eq(coachStudents.studentId, userId)),
          ),
        );
      return rows.map((row) => row.coachId);
    });
  }

  /** Internal W8 plan scope. Bounded by the configured active-student quota. */
  listActiveByCoach(coachId: string): Promise<MentorshipLinkRow[]> {
    return withServiceContext(this.db, (tx) =>
      tx
        .select()
        .from(coachStudents)
        .where(
          and(
            eq(coachStudents.coachId, coachId),
            eq(coachStudents.status, "ACTIVE"),
          ),
        )
        .orderBy(asc(coachStudents.studentId)),
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
   * Serialize everything that decides this coach's seats (a student accepting, a reseat) on one
   * advisory lock, released at commit. Checking outside it would be check-then-act: two students
   * redeeming the same code at once would both read a free seat and both take it. The invite code
   * has no use counter of its own, so the seats and the roster cap are the only bound it has.
   */
  async lockCoachInTransaction(tx: DatabaseTx, coachId: string): Promise<void> {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"mentorship:coach:" + coachId}, 0))`,
    );
  }

  /** The coach's live links, read inside the caller's transaction (under the coach lock). */
  listActiveByCoachInTransaction(tx: DatabaseTx, coachId: string): Promise<MentorshipLinkRow[]> {
    return tx
      .select()
      .from(coachStudents)
      .where(and(eq(coachStudents.coachId, coachId), eq(coachStudents.status, "ACTIVE")));
  }

  /**
   * Create the ACTIVE link on the given seat, or revive an ENDED one between the same pair: the
   * `coach_students_pair_idx` unique makes a plain insert fail on a re-link. Undefined when a row
   * exists that is not ENDED (`setWhere` skipped it), so the caller's ALREADY_LINKED check stays
   * authoritative. A link without a seat is never written: the caller refuses before this runs.
   */
  async insertOrReviveInTransaction(
    tx: DatabaseTx,
    coachId: string,
    studentId: string,
    seat: MentorshipSeatId,
    now: Date,
  ): Promise<MentorshipLinkRow | undefined> {
    const rows = await tx
      .insert(coachStudents)
      .values({ coachId, studentId, status: "ACTIVE", source: "INVITE", acceptedAt: now, seat })
      .onConflictDoUpdate({
        target: [coachStudents.coachId, coachStudents.studentId],
        set: {
          status: "ACTIVE",
          acceptedAt: now,
          endedAt: null,
          endedBy: null,
          seat,
          updatedAt: now,
          periodId: sql`gen_random_uuid()`,
        },
        setWhere: eq(coachStudents.status, "ENDED"),
      })
      .returning();
    return rows[0];
  }

  /** Write the seats a reseat decided. Live links only: one that ended meanwhile stays as it is. */
  async setSeatsInTransaction(
    tx: DatabaseTx,
    changes: readonly { id: string; seat: MentorshipSeatId }[],
  ): Promise<void> {
    const now = new Date();
    // ponytail: one UPDATE per changed link; a roster tops out at `max_active_students` (25).
    for (const change of changes) {
      await tx
        .update(coachStudents)
        .set({ seat: change.seat, updatedAt: now })
        .where(and(eq(coachStudents.id, change.id), eq(coachStudents.status, "ACTIVE")));
    }
  }

  /** ACTIVE → ENDED (idempotent). Returns the row only if this call performed the transition. */
  end(linkId: string, endedBy: string): Promise<MentorshipLinkRow | undefined> {
    return withServiceContext(this.db, (tx) =>
      this.endInTransaction(tx, linkId, endedBy),
    );
  }

  async endInTransaction(
    tx: DatabaseTx,
    linkId: string,
    endedBy: string,
  ): Promise<MentorshipLinkRow | undefined> {
    const now = new Date();
    const rows = await tx
      .update(coachStudents)
      .set({
        status: "ENDED",
        endedAt: now,
        endedBy,
        coachNote: null,
        coachNoteAt: null,
        brief: null,
        briefAt: null,
        briefFingerprint: null,
        attendedAt: null,
        attendedFlags: null,
        updatedAt: now,
      })
      .where(
        and(eq(coachStudents.id, linkId), eq(coachStudents.status, "ACTIVE")),
      )
      .returning();
    return rows[0];
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
   * Mark this student handled, over the flags the coach was looking at. `null` flags clears the
   * mark (the coach undoing it), which is why the two columns always move together.
   */
  setAttention(
    linkId: string,
    flags: MentorshipRiskFlagId[] | null,
  ): Promise<MentorshipLinkRow | undefined> {
    const now = new Date();
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(coachStudents)
        .set({
          attendedAt: flags === null ? null : now,
          attendedFlags: flags,
          updatedAt: now,
        })
        .where(and(eq(coachStudents.id, linkId), eq(coachStudents.status, "ACTIVE")))
        .returning();
      return rows[0];
    });
  }

  /**
   * Store a freshly written brief with the fingerprint of the report it was written from.
   *
   * Returns undefined when the row is gone or no longer ACTIVE. Writing takes a whole LLM call, and
   * a link can end while the model is still typing — reporting success then would hand a fresh
   * summary of a student to a coach who had already been cut off from them.
   */
  async setBrief(linkId: string, brief: string, fingerprint: string): Promise<Date | undefined> {
    const now = new Date();
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(coachStudents)
        .set({ brief, briefAt: now, briefFingerprint: fingerprint, updatedAt: now })
        .where(and(eq(coachStudents.id, linkId), eq(coachStudents.status, "ACTIVE")))
        .returning({ id: coachStudents.id });
      return rows.length > 0 ? now : undefined;
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
