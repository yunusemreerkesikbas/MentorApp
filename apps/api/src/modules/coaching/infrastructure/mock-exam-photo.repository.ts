import { Injectable } from "@nestjs/common";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { mockExamPhotoCategorizations, mockExams } from "../../../database/schema";

export type MockExamPhotoRow = typeof mockExamPhotoCategorizations.$inferSelect;

/** Data access for premium photo → subject categorization rows (RLS-scoped). */
@Injectable()
export class MockExamPhotoRepository {
  async insert(
    tx: DatabaseTx,
    row: {
      userId: string;
      mockExamId: string;
      subjectRef: string;
      storageKey: string;
      clientRequestId?: string;
    },
  ): Promise<MockExamPhotoRow> {
    const rows = await tx
      .insert(mockExamPhotoCategorizations)
      .values({
        userId: row.userId,
        mockExamId: row.mockExamId,
        subjectRef: row.subjectRef,
        storageKey: row.storageKey,
        clientRequestId: row.clientRequestId ?? null,
      })
      .returning();
    return rows[0]!;
  }

  async findByClientRequestId(
    db: Database | DatabaseTx,
    userId: string,
    clientRequestId: string,
  ): Promise<MockExamPhotoRow[]> {
    return db
      .select()
      .from(mockExamPhotoCategorizations)
      .where(
        and(
          eq(mockExamPhotoCategorizations.userId, userId),
          eq(mockExamPhotoCategorizations.clientRequestId, clientRequestId),
        ),
      );
  }

  async countSince(db: Database | DatabaseTx, userId: string, since: Date): Promise<number> {
    const rows = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(mockExamPhotoCategorizations)
      .where(
        and(
          eq(mockExamPhotoCategorizations.userId, userId),
          gte(mockExamPhotoCategorizations.createdAt, since),
        ),
      );
    return rows[0]?.n ?? 0;
  }

  async listPhotoSubjectSignals(
    db: Database | DatabaseTx,
    userId: string,
    examId?: string,
  ): Promise<Array<{ subjectRef: string; count: number }>> {
    const rows = await db
      .select({
        subjectRef: mockExamPhotoCategorizations.subjectRef,
        count: sql<number>`count(*)::int`,
      })
      .from(mockExamPhotoCategorizations)
      .innerJoin(mockExams, eq(mockExamPhotoCategorizations.mockExamId, mockExams.id))
      .where(
        examId
          ? and(
              eq(mockExamPhotoCategorizations.userId, userId),
              eq(mockExams.examId, examId),
            )
          : eq(mockExamPhotoCategorizations.userId, userId),
      )
      .groupBy(mockExamPhotoCategorizations.subjectRef)
      .orderBy(desc(sql`count(*)`));
    return rows.map((r) => ({ subjectRef: r.subjectRef, count: r.count }));
  }
}

