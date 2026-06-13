import { Injectable } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { examSubjects, subjects } from "../../../database/schema";

export type SubjectRow = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;

export interface ExamSubjectRow {
  slug: string;
  name: string;
  questionCount: number | null;
  sortOrder: number;
}

/** Data access for editorial `subjects` + `exam_subjects` rows. */
@Injectable()
export class SubjectRepository {
  async findBySlug(db: Database | DatabaseTx, slug: string): Promise<SubjectRow | undefined> {
    const rows = await db.select().from(subjects).where(eq(subjects.slug, slug)).limit(1);
    return rows[0];
  }

  async upsertBySlug(tx: DatabaseTx, data: NewSubject): Promise<SubjectRow> {
    const rows = await tx
      .insert(subjects)
      .values(data)
      .onConflictDoUpdate({
        target: subjects.slug,
        set: { name: data.name },
      })
      .returning();
    return rows[0]!;
  }

  async upsertExamSubject(
    tx: DatabaseTx,
    data: { examId: string; subjectId: string; questionCount?: number | null; sortOrder: number },
  ): Promise<void> {
    await tx
      .insert(examSubjects)
      .values({
        examId: data.examId,
        subjectId: data.subjectId,
        questionCount: data.questionCount ?? null,
        sortOrder: data.sortOrder,
      })
      .onConflictDoUpdate({
        target: [examSubjects.examId, examSubjects.subjectId],
        set: {
          questionCount: data.questionCount ?? null,
          sortOrder: data.sortOrder,
        },
      });
  }

  async listByExamId(db: Database | DatabaseTx, examId: string): Promise<ExamSubjectRow[]> {
    const rows = await db
      .select({
        slug: subjects.slug,
        name: subjects.name,
        questionCount: examSubjects.questionCount,
        sortOrder: examSubjects.sortOrder,
      })
      .from(examSubjects)
      .innerJoin(subjects, eq(examSubjects.subjectId, subjects.id))
      .where(eq(examSubjects.examId, examId))
      .orderBy(asc(examSubjects.sortOrder), asc(subjects.name));
    return rows;
  }

  async findSlugsForExam(db: Database | DatabaseTx, examId: string): Promise<Set<string>> {
    const rows = await this.listByExamId(db, examId);
    return new Set(rows.map((r) => r.slug));
  }
}
