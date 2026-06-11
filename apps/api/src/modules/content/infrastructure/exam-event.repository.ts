import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { examEvents } from "../../../database/schema";

export type ExamEventRow = typeof examEvents.$inferSelect;
export type NewExamEvent = typeof examEvents.$inferInsert;

@Injectable()
export class ExamEventRepository {
  async findByExamAndType(
    db: DatabaseTx,
    examId: string,
    type: string,
  ): Promise<ExamEventRow | undefined> {
    const rows = await db
      .select()
      .from(examEvents)
      .where(and(eq(examEvents.examId, examId), eq(examEvents.type, type)))
      .limit(1);
    return rows[0];
  }

  async upsertByExamAndType(tx: DatabaseTx, data: NewExamEvent): Promise<ExamEventRow> {
    const rows = await tx
      .insert(examEvents)
      .values(data)
      .onConflictDoUpdate({
        target: [examEvents.examId, examEvents.type],
        set: {
          eventAt: data.eventAt,
          source: data.source,
          sourceUrl: data.sourceUrl,
          verifiedAt: data.verifiedAt,
          verifiedBy: data.verifiedBy,
        },
      })
      .returning();
    return rows[0]!;
  }

  async listByExamId(db: Database | DatabaseTx, examId: string): Promise<ExamEventRow[]> {
    return db.select().from(examEvents).where(eq(examEvents.examId, examId));
  }
}
