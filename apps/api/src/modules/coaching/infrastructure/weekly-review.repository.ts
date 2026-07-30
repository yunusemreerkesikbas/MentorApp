import { Injectable } from "@nestjs/common";
import { and, eq, gte, lt } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import {
  mockExamPhotoCategorizations,
  mockExamSubjects,
  mockExams,
  moodCheckins,
  planTasks,
  studySessions,
} from "../../../database/schema";

@Injectable()
export class WeeklyReviewRepository {
  async getEvidence(
    tx: DatabaseTx,
    userId: string,
    examId: string,
    previousStart: Date,
    currentStart: Date,
    currentEnd: Date,
    previousStartDate: string,
    startDate: string,
    endDate: string,
  ) {
    const [exams, subjects, photos, sessions, moods, tasks] = await Promise.all(
      [
        tx
          .select({
            id: mockExams.id,
            takenAt: mockExams.takenAt,
            totalNet: mockExams.totalNet,
            updatedAt: mockExams.updatedAt,
          })
          .from(mockExams)
          .where(
            and(
              eq(mockExams.userId, userId),
              eq(mockExams.examId, examId),
              gte(mockExams.takenAt, previousStart),
              lt(mockExams.takenAt, currentEnd),
            ),
          ),
        tx
          .select({
            mockExamId: mockExamSubjects.mockExamId,
            subjectRef: mockExamSubjects.subjectRef,
            net: mockExamSubjects.net,
            takenAt: mockExams.takenAt,
          })
          .from(mockExamSubjects)
          .innerJoin(mockExams, eq(mockExamSubjects.mockExamId, mockExams.id))
          .where(
            and(
              eq(mockExams.userId, userId),
              eq(mockExams.examId, examId),
              gte(mockExams.takenAt, previousStart),
              lt(mockExams.takenAt, currentEnd),
            ),
          ),
        tx
          .select({
            subjectRef: mockExamPhotoCategorizations.subjectRef,
            createdAt: mockExamPhotoCategorizations.createdAt,
          })
          .from(mockExamPhotoCategorizations)
          .innerJoin(
            mockExams,
            eq(mockExamPhotoCategorizations.mockExamId, mockExams.id),
          )
          .where(
            and(
              eq(mockExamPhotoCategorizations.userId, userId),
              eq(mockExams.examId, examId),
              gte(mockExamPhotoCategorizations.createdAt, currentStart),
              lt(mockExamPhotoCategorizations.createdAt, currentEnd),
            ),
          ),
        tx
          .select({
            id: studySessions.id,
            startedAt: studySessions.startedAt,
            endedAt: studySessions.endedAt,
            actualFocusSeconds: studySessions.actualFocusSeconds,
            subject: studySessions.subject,
            updatedAt: studySessions.updatedAt,
          })
          .from(studySessions)
          .where(
            and(
              eq(studySessions.userId, userId),
              eq(studySessions.status, "COMPLETED"),
              gte(studySessions.endedAt, previousStart),
              lt(studySessions.endedAt, currentEnd),
            ),
          ),
        tx
          .select({
            checkinDate: moodCheckins.checkinDate,
            mood: moodCheckins.mood,
            updatedAt: moodCheckins.updatedAt,
          })
          .from(moodCheckins)
          .where(
            and(
              eq(moodCheckins.userId, userId),
              gte(moodCheckins.checkinDate, startDate),
              lt(moodCheckins.checkinDate, nextIsoDate(endDate)),
            ),
          ),
        tx
          .select({
            id: planTasks.id,
            taskDate: planTasks.taskDate,
            subject: planTasks.subject,
            status: planTasks.status,
            updatedAt: planTasks.updatedAt,
          })
          .from(planTasks)
          .where(
            and(
              eq(planTasks.userId, userId),
              eq(planTasks.status, "DONE"),
              gte(planTasks.taskDate, previousStartDate),
              lt(planTasks.taskDate, nextIsoDate(endDate)),
            ),
          ),
      ],
    );

    return { exams, subjects, photos, sessions, moods, tasks };
  }
}

function nextIsoDate(date: string): string {
  const value = new Date(date + "T00:00:00Z");
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}
