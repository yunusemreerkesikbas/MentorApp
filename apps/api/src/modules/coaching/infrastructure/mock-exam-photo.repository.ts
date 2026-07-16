import { Injectable } from "@nestjs/common";
import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import {
  mockExamPhotoCategorizations,
  mockExams,
} from "../../../database/schema";

export type MockExamPhotoRow = typeof mockExamPhotoCategorizations.$inferSelect;

@Injectable()
export class MockExamPhotoRepository {
  async insert(
    tx: DatabaseTx,
    row: {
      userId: string;
      mockExamId: string;
      subjectRef: string;
      topicRef?: string | null;
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
        topicRef: row.topicRef ?? null,
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
  ) {
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

  async countSince(
    db: Database | DatabaseTx,
    userId: string,
    since: Date,
  ): Promise<number> {
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

  async listStorageKeys(
    db: Database | DatabaseTx,
    userId: string,
    mockExamId: string,
  ): Promise<string[]> {
    const rows = await db
      .selectDistinct({ storageKey: mockExamPhotoCategorizations.storageKey })
      .from(mockExamPhotoCategorizations)
      .where(
        and(
          eq(mockExamPhotoCategorizations.userId, userId),
          eq(mockExamPhotoCategorizations.mockExamId, mockExamId),
        ),
      );
    return rows.map((row) => row.storageKey);
  }

  async listPhotoSubjectSignals(
    db: Database | DatabaseTx,
    userId: string,
    examId?: string,
    mockExamIds?: string[],
  ): Promise<Array<{ subjectRef: string; count: number }>> {
    if (mockExamIds?.length === 0) return [];
    const rows = await db
      .select({
        subjectRef: mockExamPhotoCategorizations.subjectRef,
        count: sql<number>`count(*)::int`,
      })
      .from(mockExamPhotoCategorizations)
      .innerJoin(
        mockExams,
        eq(mockExamPhotoCategorizations.mockExamId, mockExams.id),
      )
      .where(
        and(
          eq(mockExamPhotoCategorizations.userId, userId),
          examId ? eq(mockExams.examId, examId) : undefined,
          mockExamIds
            ? inArray(mockExamPhotoCategorizations.mockExamId, mockExamIds)
            : undefined,
        ),
      )
      .groupBy(mockExamPhotoCategorizations.subjectRef)
      .orderBy(desc(sql`count(*)`));
    return rows;
  }

  async listPhotoTopicSignals(
    db: Database | DatabaseTx,
    userId: string,
    examId: string | undefined,
    mockExamIds: string[],
  ): Promise<
    Array<{
      subjectRef: string;
      topicRef: string;
      count: number;
      latestAt: Date;
    }>
  > {
    if (mockExamIds.length === 0) return [];
    const rows = await db
      .select({
        subjectRef: mockExamPhotoCategorizations.subjectRef,
        topicRef: mockExamPhotoCategorizations.topicRef,
        count: sql<number>`count(*)::int`,
        latestAt: sql<Date>`max(${mockExamPhotoCategorizations.createdAt})`,
      })
      .from(mockExamPhotoCategorizations)
      .innerJoin(
        mockExams,
        eq(mockExamPhotoCategorizations.mockExamId, mockExams.id),
      )
      .where(
        and(
          eq(mockExamPhotoCategorizations.userId, userId),
          isNotNull(mockExamPhotoCategorizations.topicRef),
          examId ? eq(mockExams.examId, examId) : undefined,
          inArray(mockExamPhotoCategorizations.mockExamId, mockExamIds),
        ),
      )
      .groupBy(
        mockExamPhotoCategorizations.subjectRef,
        mockExamPhotoCategorizations.topicRef,
      )
      .orderBy(
        desc(sql`count(*)`),
        desc(sql`max(${mockExamPhotoCategorizations.createdAt})`),
      );
    return rows.map((row) => ({ ...row, topicRef: row.topicRef! }));
  }
}
