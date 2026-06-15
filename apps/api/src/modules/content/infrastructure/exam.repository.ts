import { Injectable } from "@nestjs/common";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { examEvents, exams } from "../../../database/schema";
import { ExamEventType } from "../domain/content.constants";

export type ExamRow = typeof exams.$inferSelect;
export type ExamEventRow = typeof examEvents.$inferSelect;
export type NewExam = typeof exams.$inferInsert;
export type NewExamEvent = typeof examEvents.$inferInsert;

/** Data access for editorial `exams` rows. Writes use SERVICE context (seed/admin). */
@Injectable()
export class ExamRepository {
  async findBySlug(db: Database | DatabaseTx, slug: string): Promise<ExamRow | undefined> {
    const rows = await db.select().from(exams).where(eq(exams.slug, slug)).limit(1);
    return rows[0];
  }

  async listPaged(
    db: Database | DatabaseTx,
    family: string | undefined,
    page: number,
    pageSize: number,
  ): Promise<{ items: ExamRow[]; total: number }> {
    const where = family ? eq(exams.family, family) : undefined;
    const [items, totalRow] = await Promise.all([
      db
        .select()
        .from(exams)
        .where(where)
        .orderBy(asc(exams.family), asc(exams.name))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ count: sql<number>`count(*)::int` }).from(exams).where(where),
    ]);
    return { items, total: totalRow[0]?.count ?? 0 };
  }

  async upsertBySlug(tx: DatabaseTx, data: NewExam): Promise<ExamRow> {
    const rows = await tx
      .insert(exams)
      .values(data)
      .onConflictDoUpdate({
        target: exams.slug,
        set: {
          name: data.name,
          family: data.family,
          variant: data.variant,
          netRule: data.netRule,
          isCurrent: data.isCurrent,
          orgId: data.orgId,
        },
      })
      .returning();
    return rows[0]!;
  }

  /** All exams in a family with their EXAM_DATE event (for countdown selection). */
  async listFamilyCandidates(
    db: Database | DatabaseTx,
    family: string,
  ): Promise<
    Array<{
      exam: ExamRow;
      event: ExamEventRow;
    }>
  > {
    const rows = await db
      .select({ exam: exams, event: examEvents })
      .from(exams)
      .innerJoin(
        examEvents,
        and(eq(examEvents.examId, exams.id), eq(examEvents.type, ExamEventType.EXAM_DATE)),
      )
      .where(eq(exams.family, family));
    return rows;
  }

  async findNetRuleForFamily(
    db: Database | DatabaseTx,
    family: string,
  ): Promise<{ kind: string; divisor: number } | null> {
    const rows = await db
      .select({ netRule: exams.netRule, isCurrent: exams.isCurrent })
      .from(exams)
      .where(eq(exams.family, family))
      .orderBy(sql`${exams.isCurrent} desc`, asc(exams.slug))
      .limit(1);
    const rule = rows[0]?.netRule;
    if (!rule || typeof rule !== "object") return null;
    const obj = rule as { kind?: string; divisor?: number };
    if (typeof obj.kind !== "string" || typeof obj.divisor !== "number") return null;
    return { kind: obj.kind, divisor: obj.divisor };
  }

  async findById(db: Database | DatabaseTx, id: string): Promise<ExamRow | undefined> {
    const rows = await db.select().from(exams).where(eq(exams.id, id)).limit(1);
    return rows[0];
  }
}
