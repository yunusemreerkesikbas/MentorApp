import { Injectable } from "@nestjs/common";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { mockExams, mockExamSubjects, planTasks } from "../../../database/schema";

@Injectable()
export class WeeklyReportTaskRepository {
  async find(tx: DatabaseTx, userId: string, reportId: string) {
    return (await tx.select().from(planTasks).where(and(eq(planTasks.userId, userId),
      eq(planTasks.originType, "WEEKLY_REPORT"), eq(planTasks.originRefId, reportId))).limit(1))[0];
  }

  async measurement(tx: DatabaseTx, userId: string, examId: string, subjectRef: string, after: Date, before: Date) {
    return (await tx.select({ net: mockExamSubjects.net, takenAt: mockExams.takenAt })
      .from(mockExams).innerJoin(mockExamSubjects, eq(mockExamSubjects.mockExamId, mockExams.id))
      .where(and(eq(mockExams.userId, userId), eq(mockExams.examId, examId),
        eq(mockExamSubjects.subjectRef, subjectRef), gt(mockExams.createdAt, after),
        gt(mockExams.takenAt, after), lt(mockExams.takenAt, before), lt(mockExams.createdAt, before)))
      .orderBy(asc(mockExams.takenAt), asc(mockExams.createdAt), asc(mockExams.id)).limit(1))[0];
  }
}
