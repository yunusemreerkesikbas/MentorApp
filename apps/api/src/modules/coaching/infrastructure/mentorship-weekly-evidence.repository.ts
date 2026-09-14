import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import {
  exams,
  mockExamSubjects,
  mockExams,
  planTasks,
  studySessions,
} from "../../../database/schema";
import type { MentorshipWeekPeriod } from "../domain/mentorship-weekly-report";
import type { MentorshipWeeklyRawEvidence } from "../domain/mentorship-weekly-snapshot";

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

function localMidnightUtc(date: string): Date {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) - ISTANBUL_OFFSET_MS);
}

@Injectable()
export class MentorshipWeeklyEvidenceRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async getEvidence(
    studentId: string,
    examType: string | null,
    period: MentorshipWeekPeriod,
  ): Promise<MentorshipWeeklyRawEvidence> {
    const startedAt = localMidnightUtc(period.previousStartDate);
    const endedBefore = new Date(
      localMidnightUtc(period.endDate).getTime() + DAY_MS,
    );

    const [sessions, tasks, attempts] = await withServiceContext(
      this.db,
      async (tx) => {
        const sessionQuery = tx
          .select({
            endedAt: studySessions.endedAt,
            focusSeconds: studySessions.actualFocusSeconds,
            subject: studySessions.subject,
          })
          .from(studySessions)
          .where(
            and(
              eq(studySessions.userId, studentId),
              eq(studySessions.status, "COMPLETED"),
              gte(studySessions.endedAt, startedAt),
              lt(studySessions.endedAt, endedBefore),
            ),
          );
        const taskQuery = tx
          .select({ taskDate: planTasks.taskDate, status: planTasks.status })
          .from(planTasks)
          .where(
            and(
              eq(planTasks.userId, studentId),
              gte(planTasks.taskDate, period.previousStartDate),
              lte(planTasks.taskDate, period.endDate),
            ),
          );
        const mockQuery = examType
          ? tx
              .select({
                id: mockExams.id,
                examId: mockExams.examId,
                examName: exams.name,
                takenAt: mockExams.takenAt,
                totalNet: mockExams.totalNet,
                publisherName: mockExams.publisherName,
              })
              .from(mockExams)
              .innerJoin(exams, eq(mockExams.examId, exams.id))
              .where(
                and(
                  eq(mockExams.userId, studentId),
                  eq(exams.family, examType),
                  gte(mockExams.takenAt, startedAt),
                  lt(mockExams.takenAt, endedBefore),
                ),
              )
          : Promise.resolve([]);
        return Promise.all([sessionQuery, taskQuery, mockQuery]);
      },
    );

    const attemptIds = attempts.map((row) => row.id);
    const subjects =
      attemptIds.length === 0
        ? []
        : await withServiceContext(this.db, (tx) =>
            tx
              .select({
                mockExamId: mockExamSubjects.mockExamId,
                subjectRef: mockExamSubjects.subjectRef,
                net: mockExamSubjects.net,
              })
              .from(mockExamSubjects)
              .where(inArray(mockExamSubjects.mockExamId, attemptIds)),
          );

    return {
      sessions: sessions
        .filter(
          (row): row is typeof row & { endedAt: Date } => row.endedAt !== null,
        )
        .map((row) => ({
          endedAt: row.endedAt,
          focusSeconds: row.focusSeconds,
          subject: row.subject,
        })),
      tasks,
      mocks: attempts.map((attempt) => ({
        examId: attempt.examId,
        examName: attempt.examName,
        takenAt: attempt.takenAt,
        totalNet: Number(attempt.totalNet),
        publisherName: attempt.publisherName,
        subjects: subjects
          .filter((subject) => subject.mockExamId === attempt.id)
          .map((subject) => ({
            subjectRef: subject.subjectRef,
            net: Number(subject.net),
          })),
      })),
    };
  }
}
