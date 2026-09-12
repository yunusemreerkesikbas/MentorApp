import { Injectable, Inject } from "@nestjs/common";
import { and, asc, count, desc, eq, isNotNull, lte, or, sql } from "drizzle-orm";
import type { ListMentorshipFollowupsQuery } from "@mentor/validation";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { coachStudents, mentorshipFollowups as followups } from "../../../database/schema";

export type FollowupRow = typeof followups.$inferSelect;
export type FollowupInsert = typeof followups.$inferInsert;
export type FollowupScope = { id: string; periodId: string; studentId: string; coachId: string };
const currentPeriod = and(eq(followups.linkId, coachStudents.id), eq(followups.periodId, coachStudents.periodId), eq(coachStudents.status, "ACTIVE"));
const actionable = (today: string) => and(eq(followups.status, "OPEN"), or(eq(followups.response, "CHANGE_REQUESTED"), lte(followups.followUpDate, today)));
const due = (today: string) => and(eq(followups.status, "OPEN"), lte(followups.followUpDate, today));

@Injectable()
export class MentorshipFollowupRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  find(tx: DatabaseTx, scope: FollowupScope, id: string) {
    return tx.select().from(followups).where(and(eq(followups.id, id), eq(followups.linkId, scope.id), eq(followups.periodId, scope.periodId))).then((rows) => rows[0]);
  }

  findOperation(tx: DatabaseTx, scope: FollowupScope, operationId: string) {
    return tx.select().from(followups).where(and(eq(followups.linkId, scope.id), eq(followups.periodId, scope.periodId), eq(followups.operationId, operationId))).then((rows) => rows[0]);
  }

  async create(tx: DatabaseTx, data: FollowupInsert): Promise<FollowupRow> {
    const [row] = await tx.insert(followups).values(data).returning();
    if (!row) throw new Error("Follow-up insert returned no row");
    return row;
  }

  async update(tx: DatabaseTx, row: FollowupRow, patch: Partial<FollowupInsert>): Promise<FollowupRow> {
    const [updated] = await tx.update(followups).set({ ...patch, version: row.version + 1, updatedAt: new Date() }).where(and(eq(followups.id, row.id), eq(followups.version, row.version))).returning();
    if (!updated) throw new Error("Locked follow-up disappeared");
    return updated;
  }

  listCoach(coachId: string, query: ListMentorshipFollowupsQuery, today: string) {
    return withServiceContext(this.db, async (tx) => {
      const where = and(eq(coachStudents.coachId, coachId), query.studentId ? eq(coachStudents.studentId, query.studentId) : undefined, query.view === "ACTIONABLE" ? actionable(today) : undefined);
      const order = query.view === "ACTIONABLE"
        ? [sql`CASE WHEN ${followups.response} = 'CHANGE_REQUESTED' THEN 0 ELSE 1 END`, sql`${followups.followUpDate} ASC NULLS LAST`, asc(followups.createdAt), asc(followups.id)]
        : [desc(followups.createdAt), desc(followups.id)];
      const rows = await tx.select({ followup: followups, studentId: coachStudents.studentId }).from(followups).innerJoin(coachStudents, currentPeriod).where(where).orderBy(...order).limit(query.pageSize).offset((query.page - 1) * query.pageSize);
      const [total] = await tx.select({ n: count() }).from(followups).innerJoin(coachStudents, currentPeriod).where(where);
      return { rows, total: total?.n ?? 0 };
    });
  }

  listStudent(studentId: string, page: number, pageSize: number) {
    return withServiceContext(this.db, async (tx) => {
      const where = and(eq(coachStudents.studentId, studentId), isNotNull(followups.sharedDecision));
      const rows = await tx.select({ followup: followups }).from(followups).innerJoin(coachStudents, currentPeriod).where(where).orderBy(desc(followups.createdAt), desc(followups.id)).limit(pageSize).offset((page - 1) * pageSize);
      const [total] = await tx.select({ n: count() }).from(followups).innerJoin(coachStudents, currentPeriod).where(where);
      return { rows: rows.map((row) => row.followup), total: total?.n ?? 0 };
    });
  }

  notificationTarget(id: string, kind: "shared" | "responded", version: number) {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx.select({ coachId: coachStudents.coachId, studentId: coachStudents.studentId }).from(followups).innerJoin(coachStudents, currentPeriod).where(and(eq(followups.id, id), eq(followups.version, version), eq(followups.status, "OPEN"), isNotNull(followups.sharedDecision), kind === "shared" ? eq(followups.response, "PENDING") : or(eq(followups.response, "ACCEPTED"), eq(followups.response, "CHANGE_REQUESTED"))));
      return row;
    });
  }

  listDueCoachIds(today: string): Promise<string[]> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.selectDistinct({ coachId: coachStudents.coachId }).from(followups).innerJoin(coachStudents, currentPeriod).where(due(today));
      return rows.map((row) => row.coachId);
    });
  }

  getDueCount(coachId: string, today: string): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx.select({ n: count() }).from(followups).innerJoin(coachStudents, currentPeriod).where(and(eq(coachStudents.coachId, coachId), due(today)));
      return row?.n ?? 0;
    });
  }
}
