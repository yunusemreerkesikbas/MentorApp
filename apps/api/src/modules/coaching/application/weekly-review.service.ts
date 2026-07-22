import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { I18nContext, I18nService } from "nestjs-i18n";
import type { WeeklyReviewDto } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { CONTENT_PORT, type ContentPort } from "../domain/content.port";
import { formatNet, formatNetDelta } from "../domain/net";
import {
  energySignal,
  isWeeklyReviewReady,
  selectWeeklyFocus,
  weeklyReviewWindows,
} from "../domain/weekly-review";
import { WeeklyReviewRepository } from "../infrastructure/weekly-review.repository";

@Injectable()
export class WeeklyReviewService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(CONTENT_PORT) private readonly content: ContentPort,
    private readonly repository: WeeklyReviewRepository,
    private readonly i18n: I18nService,
  ) {}

  async getReview(userId: string, examId: string, now = new Date()): Promise<WeeklyReviewDto> {
    return (await this.build(userId, examId, now)).review;
  }

  async getAiEvidence(userId: string, examId: string, now = new Date()) {
    return this.build(userId, examId, now);
  }

  private async build(userId: string, examId: string, now: Date) {
    const [exam, taxonomy] = await Promise.all([
      this.content.getExamById(examId),
      this.content.listExamSubjects(examId),
    ]);
    if (!exam) {
      throw new DomainError(ErrorCode.CONTENT_EXAM_NOT_FOUND, HttpStatus.NOT_FOUND, { examId });
    }

    const windows = weeklyReviewWindows(now);
    const evidence = await withUserContext(this.db, { userId }, (tx) =>
      this.repository.getEvidence(
        tx,
        userId,
        examId,
        windows.previous.start,
        windows.current.start,
        windows.current.end,
        windows.startDate,
        windows.endDate,
      ),
    );

    const currentExams = evidence.exams.filter((row) => row.takenAt >= windows.current.start);
    const previousExams = evidence.exams.filter((row) => row.takenAt < windows.current.start);
    const currentIds = new Set(currentExams.map((row) => row.id));
    const previousIds = new Set(previousExams.map((row) => row.id));
    const average = (values: number[]) =>
      values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
    const currentAverage = average(currentExams.map((row) => Number(row.totalNet)));
    const previousAverage = average(previousExams.map((row) => Number(row.totalNet)));

    const subjectAverage = (subjectRef: string, ids: Set<string>) =>
      average(
        evidence.subjects
          .filter((row) => row.subjectRef === subjectRef && ids.has(row.mockExamId))
          .map((row) => Number(row.net)),
      );
    const subjectInputs = taxonomy.map((subject) => ({
      subjectRef: subject.slug,
      subjectName: subject.name,
      questionCount: subject.questionCount,
      currentAverageNet: subjectAverage(subject.slug, currentIds),
      previousAverageNet: subjectAverage(subject.slug, previousIds),
    }));
    const photoCounts = new Map<string, number>();
    for (const row of evidence.photos) {
      photoCounts.set(row.subjectRef, (photoCounts.get(row.subjectRef) ?? 0) + 1);
    }

    const completedSessionCount = evidence.sessions.length;
    const ready = isWeeklyReviewReady(currentExams.length, completedSessionCount);
    const focusSelection = ready
      ? selectWeeklyFocus(
          subjectInputs,
          [...photoCounts].map(([subjectRef, count]) => ({ subjectRef, count })),
          currentExams.length > 0,
        )
      : null;
    const moods = evidence.moods.map((row) => row.mood);
    const energy = energySignal(moods);
    const focusMinutes = Math.round(
      evidence.sessions.reduce((sum, row) => sum + row.actualFocusSeconds, 0) / 60,
    );
    const activeDays = new Set(
      evidence.sessions
        .map((row) => row.endedAt)
        .filter((value): value is Date => value != null)
        .map((value) => istanbulDate(value)),
    ).size;
    const lang = I18nContext.current()?.lang;
    const t = (key: string, args?: Record<string, unknown>) =>
      this.i18n.translate(`coaching.weekly.${key}`, { lang, args }) as unknown as string;

    const focus =
      focusSelection == null
        ? null
        : {
            ...focusSelection,
            message: t(`FOCUS_${focusSelection.source}`, {
              subject: focusSelection.subjectName ?? "",
            }),
          };
    const reviewSuggestedTask = ready
      ? focusSelection?.subjectName
        ? {
            title: t("TASK_SUBJECT", {
              subject: focusSelection.subjectName,
            }),
            subject: focusSelection.subjectName,
          }
        : { title: t("TASK_SESSION"), subject: null }
      : null;
    const review: WeeklyReviewDto = {
      period: {
        startDate: windows.startDate,
        endDate: windows.endDate,
        timeZone: "Europe/Istanbul",
      },
      status: ready ? "READY" : "INSUFFICIENT",
      evidence: { mockExamCount: currentExams.length, completedSessionCount },
      rhythm: {
        completedSessionCount,
        focusMinutes,
        activeDays,
        moodCheckinCount: moods.length,
        energySignal: energy,
        message: ready
          ? t(energy ? `RHYTHM_${energy}` : "RHYTHM", {
              sessions: completedSessionCount,
              minutes: focusMinutes,
              days: activeDays,
            })
          : t("INSUFFICIENT"),
      },
      performance:
        currentAverage == null
          ? null
          : {
              mockExamCount: currentExams.length,
              averageNet: formatNet(currentAverage),
              previousWeekAverageNet:
                previousAverage == null ? null : formatNet(previousAverage),
              delta:
                previousAverage == null ? null : formatNetDelta(currentAverage - previousAverage),
              evidenceLevel: previousAverage == null ? "EARLY" : "COMPARABLE",
              message:
                previousAverage == null
                  ? t("PERFORMANCE_EARLY", { net: formatNet(currentAverage) })
                  : t("PERFORMANCE_COMPARABLE", {
                      net: formatNet(currentAverage),
                      delta: formatNetDelta(currentAverage - previousAverage),
                    }),
            },
      focus,
      suggestedTask: reviewSuggestedTask,
    };

    const suggestedTask =
      focusSelection?.subjectName
        ? {
            subjectRef: focusSelection.subjectRef,
            title: t("TASK_SUBJECT", { subject: focusSelection.subjectName }),
          }
        : { subjectRef: null, title: t("TASK_SESSION") };

    return {
      review,
      suggestedTask,
      fingerprintInput: {
        review,
        examUpdated: evidence.exams.map((row) => [row.id, row.updatedAt.toISOString()]),
        subjects: evidence.subjects.map((row) => [
          row.mockExamId,
          row.subjectRef,
          row.net,
          row.takenAt.toISOString(),
        ]),
        photos: evidence.photos.map((row) => [
          row.subjectRef,
          row.createdAt.toISOString(),
        ]),
        sessionUpdated: evidence.sessions.map((row) => [row.id, row.updatedAt.toISOString()]),
        moodUpdated: evidence.moods.map((row) => [row.checkinDate, row.updatedAt.toISOString()]),
        taxonomy: taxonomy.map((row) => [row.slug, row.name, row.questionCount]),
      },
    };
  }
}

function istanbulDate(date: Date): string {
  return new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}



