import { Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { mockExamSubjects, mockExams } from "../../../database/schema";

export type MockExamRow = typeof mockExams.$inferSelect;
export type MockExamSubjectRow = typeof mockExamSubjects.$inferSelect;

export interface NewMockExamSubject {
  subjectRef: string;
  correct: number;
  wrong: number;
  blank: number;
  net: string;
}

function userExamScope(userId: string, examId?: string) {
  return examId
    ? and(eq(mockExams.userId, userId), eq(mockExams.examId, examId))
    : eq(mockExams.userId, userId);
}

/** Data access for `mock_exams` + `mock_exam_subjects` (RLS-scoped). */
@Injectable()
export class MockExamRepository {
  async create(
    tx: DatabaseTx,
    data: {
      userId: string;
      examId: string;
      takenAt: Date;
      totalNet: string;
      publisherName?: string | null;
      subjects: NewMockExamSubject[];
    },
  ): Promise<{ exam: MockExamRow; subjects: MockExamSubjectRow[] }> {
    const examRows = await tx
      .insert(mockExams)
      .values({
        userId: data.userId,
        examId: data.examId,
        takenAt: data.takenAt,
        totalNet: data.totalNet,
        publisherName: data.publisherName ?? null,
      })
      .returning();
    const exam = examRows[0]!;

    const subjectRows =
      data.subjects.length === 0
        ? []
        : await tx
            .insert(mockExamSubjects)
            .values(
              data.subjects.map((s) => ({
                mockExamId: exam.id,
                subjectRef: s.subjectRef,
                correct: s.correct,
                wrong: s.wrong,
                blank: s.blank,
                net: s.net,
              })),
            )
            .returning();

    return { exam, subjects: subjectRows };
  }

  async findById(
    db: Database | DatabaseTx,
    userId: string,
    id: string,
  ): Promise<{ exam: MockExamRow; subjects: MockExamSubjectRow[] } | undefined> {
    const examRows = await db
      .select()
      .from(mockExams)
      .where(and(eq(mockExams.id, id), eq(mockExams.userId, userId)))
      .limit(1);
    const exam = examRows[0];
    if (!exam) return undefined;

    const subjects = await db
      .select()
      .from(mockExamSubjects)
      .where(eq(mockExamSubjects.mockExamId, exam.id));
    return { exam, subjects };
  }

  async update(
    tx: DatabaseTx,
    userId: string,
    id: string,
    data: {
      takenAt: Date;
      totalNet: string;
      publisherName: string | null;
      subjects: NewMockExamSubject[];
    },
  ): Promise<{ exam: MockExamRow; subjects: MockExamSubjectRow[] } | undefined> {
    const examRows = await tx
      .update(mockExams)
      .set({
        takenAt: data.takenAt,
        totalNet: data.totalNet,
        publisherName: data.publisherName,
        updatedAt: new Date(),
      })
      .where(and(eq(mockExams.id, id), eq(mockExams.userId, userId)))
      .returning();
    const exam = examRows[0];
    if (!exam) return undefined;

    await tx.delete(mockExamSubjects).where(eq(mockExamSubjects.mockExamId, id));
    const subjects = await tx
      .insert(mockExamSubjects)
      .values(data.subjects.map((subject) => ({ ...subject, mockExamId: id })))
      .returning();
    return { exam, subjects };
  }

  async delete(tx: DatabaseTx, userId: string, id: string): Promise<boolean> {
    const rows = await tx
      .delete(mockExams)
      .where(and(eq(mockExams.id, id), eq(mockExams.userId, userId)))
      .returning({ id: mockExams.id });
    return rows.length > 0;
  }

  async clearGhostNarrations(
    tx: DatabaseTx,
    userId: string,
    examId: string,
  ): Promise<void> {
    await tx
      .update(mockExams)
      .set({
        aiGhostNarration: null,
        aiGhostModel: null,
        aiGhostAt: null,
        updatedAt: new Date(),
      })
      .where(userExamScope(userId, examId));
  }

  async listPaged(
    db: Database | DatabaseTx,
    userId: string,
    page: number,
    pageSize: number,
    examId?: string,
  ): Promise<{ items: MockExamRow[]; total: number }> {
    const [items, totalRow] = await Promise.all([
      db
        .select()
        .from(mockExams)
        .where(userExamScope(userId, examId))
        .orderBy(desc(mockExams.takenAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(mockExams)
        .where(userExamScope(userId, examId)),
    ]);
    return { items, total: totalRow[0]?.count ?? 0 };
  }

  async listSubjectsByMockExamIds(
    db: Database | DatabaseTx,
    mockExamIds: string[],
  ): Promise<Map<string, MockExamSubjectRow[]>> {
    if (mockExamIds.length === 0) return new Map();
    const rows = await db
      .select()
      .from(mockExamSubjects)
      .where(inArray(mockExamSubjects.mockExamId, mockExamIds));
    const map = new Map<string, MockExamSubjectRow[]>();
    for (const row of rows) {
      const list = map.get(row.mockExamId) ?? [];
      list.push(row);
      map.set(row.mockExamId, list);
    }
    return map;
  }

  /** All-time best total net for the user, EXCLUDING one attempt (the latest) — drives "rekor". */
  async maxNetExcluding(
    db: Database | DatabaseTx,
    userId: string,
    excludeId: string,
    examId?: string,
  ): Promise<string | null> {
    const rows = await db
      .select({ max: sql<string | null>`MAX(${mockExams.totalNet})::text` })
      .from(mockExams)
      .where(and(userExamScope(userId, examId), ne(mockExams.id, excludeId)));
    return rows[0]?.max ?? null;
  }

  /** Cache the premium ghost narration on a specific attempt (tx owns RLS). */
  async setGhostNarration(
    tx: DatabaseTx,
    id: string,
    narration: string,
    model: string,
  ): Promise<void> {
    await tx
      .update(mockExams)
      .set({ aiGhostNarration: narration, aiGhostModel: model, aiGhostAt: new Date() })
      .where(eq(mockExams.id, id));
  }

  async maxTotalNet(
    db: Database | DatabaseTx,
    userId: string,
    examId?: string,
  ): Promise<string | null> {
    const rows = await db
      .select({
        max: sql<string | null>`max(${mockExams.totalNet}::numeric)::text`,
      })
      .from(mockExams)
      .where(userExamScope(userId, examId));
    return rows[0]?.max ?? null;
  }

  async listTrend(
    db: Database | DatabaseTx,
    userId: string,
    limit = 12,
    examId?: string,
  ): Promise<MockExamRow[]> {
    return db
      .select()
      .from(mockExams)
      .where(userExamScope(userId, examId))
      .orderBy(desc(mockExams.takenAt))
      .limit(limit);
  }

  async listSubjectBreakdown(
    db: Database | DatabaseTx,
    userId: string,
    examId?: string,
  ): Promise<Array<{ subjectRef: string; avgNet: string; attemptCount: number }>> {
    const rows = await db
      .select({
        subjectRef: mockExamSubjects.subjectRef,
        avgNet: sql<string>`ROUND(AVG(${mockExamSubjects.net}::numeric), 2)::text`,
        attemptCount: sql<number>`count(*)::int`,
      })
      .from(mockExamSubjects)
      .innerJoin(mockExams, eq(mockExamSubjects.mockExamId, mockExams.id))
      .where(userExamScope(userId, examId))
      .groupBy(mockExamSubjects.subjectRef)
      .orderBy(desc(sql`AVG(${mockExamSubjects.net}::numeric)`));
    return rows.map((r) => ({
      subjectRef: r.subjectRef,
      avgNet: r.avgNet,
      attemptCount: r.attemptCount,
    }));
  }
}
