import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { I18nContext, I18nService } from "nestjs-i18n";
import type { WeeklyReviewDto } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { CONTENT_PORT, type ContentPort } from "../domain/content.port";
import { formatNet, formatNetDelta } from "../domain/net";
import {
  buildWeeklyActivitySummary,
  energySignal,
  istanbulDate,
  selectPositiveWeeklyComparison,
  selectWeeklyFocusTimeBand,
  selectWeeklyHighlights,
  selectWeeklyFocus,
  selectWeeklyNextStorySignals,
  selectWeeklyTitle,
  weeklyPlanSubjectBreakdown,
  weeklyPeakFocusDay,
  weeklyRecapStatus,
  weeklySessionSubjectBreakdown,
  weeklyReviewWindows,
  type WeeklyHighlightCandidate,
} from "../domain/weekly-review";
import { WeeklyReviewRepository } from "../infrastructure/weekly-review.repository";

@Injectable()
export class WeeklyReviewService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(CONTENT_PORT) private readonly content: ContentPort,
    private readonly repository: WeeklyReviewRepository,
    private readonly config: ConfigRegistryService,
    private readonly i18n: I18nService,
  ) {}

  async getReview(
    userId: string,
    examId: string,
    now = new Date(),
  ): Promise<WeeklyReviewDto> {
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
      throw new DomainError(
        ErrorCode.CONTENT_EXAM_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        { examId },
      );
    }

    const windows = weeklyReviewWindows(now);
    const [
      evidence,
      minFocusSeconds,
      readyMockExamCount,
      readySessionCount,
      readyPlanTaskCount,
      comparisonMinFocusMinutesDelta,
      comparisonMinLongestSessionMinutesDelta,
      comparisonMinActiveDaysDelta,
      comparisonMinPlanTasksDelta,
      titleRhythmRunDays,
      titleDeepFocusMinutes,
      titlePlanTaskCount,
      titleFocusedSubjectCount,
      titleMockExamCount,
      titleBalancedChannelCount,
    ] = await Promise.all([
      withUserContext(this.db, { userId }, (tx) =>
        this.repository.getEvidence(
          tx,
          userId,
          examId,
          windows.previous.start,
          windows.current.start,
          windows.current.end,
          istanbulDate(windows.previous.start),
          windows.startDate,
          windows.endDate,
        ),
      ),
      this.config.get("coaching.session.min_focus_seconds"),
      this.config.get("coaching.weekly_recap.ready_mock_exam_count"),
      this.config.get("coaching.weekly_recap.ready_session_count"),
      this.config.get("coaching.weekly_recap.ready_plan_task_count"),
      this.config.get(
        "coaching.weekly_recap.comparison_min_focus_minutes_delta",
      ),
      this.config.get(
        "coaching.weekly_recap.comparison_min_longest_session_minutes_delta",
      ),
      this.config.get(
        "coaching.weekly_recap.comparison_min_active_days_delta",
      ),
      this.config.get(
        "coaching.weekly_recap.comparison_min_plan_tasks_delta",
      ),
      this.config.get("coaching.weekly_recap.title_rhythm_run_days"),
      this.config.get("coaching.weekly_recap.title_deep_focus_minutes"),
      this.config.get("coaching.weekly_recap.title_plan_task_count"),
      this.config.get("coaching.weekly_recap.title_focused_subject_count"),
      this.config.get("coaching.weekly_recap.title_mock_exam_count"),
      this.config.get("coaching.weekly_recap.title_balanced_channel_count"),
    ]);

    const currentExams = evidence.exams.filter(
      (row) => row.takenAt >= windows.current.start,
    );
    const previousExams = evidence.exams.filter(
      (row) => row.takenAt < windows.current.start,
    );
    const currentIds = new Set(currentExams.map((row) => row.id));
    const previousIds = new Set(previousExams.map((row) => row.id));
    const average = (values: number[]) =>
      values.length === 0
        ? null
        : values.reduce((sum, value) => sum + value, 0) / values.length;
    const currentAverage = average(
      currentExams.map((row) => Number(row.totalNet)),
    );
    const previousAverage = average(
      previousExams.map((row) => Number(row.totalNet)),
    );

    const subjectAverage = (subjectRef: string, ids: Set<string>) =>
      average(
        evidence.subjects
          .filter(
            (row) => row.subjectRef === subjectRef && ids.has(row.mockExamId),
          )
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
      photoCounts.set(
        row.subjectRef,
        (photoCounts.get(row.subjectRef) ?? 0) + 1,
      );
    }

    const currentSessions = evidence.sessions.filter(
      (row) =>
        row.endedAt != null &&
        row.endedAt >= windows.current.start &&
        row.endedAt < windows.current.end,
    );
    const previousSessions = evidence.sessions.filter(
      (row) =>
        row.endedAt != null &&
        row.endedAt >= windows.previous.start &&
        row.endedAt < windows.previous.end,
    );
    const qualifyingSessions = currentSessions.filter(
      (row) => row.actualFocusSeconds >= minFocusSeconds,
    );
    const previousQualifyingSessions = previousSessions.filter(
      (row) => row.actualFocusSeconds >= minFocusSeconds,
    );
    const currentTasks = evidence.tasks.filter(
      (row) => row.taskDate >= windows.startDate,
    );
    const previousTasks = evidence.tasks.filter(
      (row) => row.taskDate < windows.startDate,
    );
    const completedSessionCount = qualifyingSessions.length;
    const completedPlanTaskCount = currentTasks.length;
    const recapStatus = weeklyRecapStatus(
      {
        mockExamCount: currentExams.length,
        qualifyingSessionCount: completedSessionCount,
        completedPlanTaskCount,
      },
      {
        mockExamCount: readyMockExamCount,
        qualifyingSessionCount: readySessionCount,
        completedPlanTaskCount: readyPlanTaskCount,
      },
    );
    const ready = recapStatus === "READY";
    const focusSelection = ready
      ? selectWeeklyFocus(
          subjectInputs,
          [...photoCounts].map(([subjectRef, count]) => ({
            subjectRef,
            count,
          })),
          currentExams.length > 0,
        )
      : null;
    const moods = evidence.moods.map((row) => row.mood);
    const energy = energySignal(moods);
    const focusMinutes = Math.round(
      qualifyingSessions.reduce((sum, row) => sum + row.actualFocusSeconds, 0) /
        60,
    );
    const longestSessionMinutes = longestSession(qualifyingSessions);
    const focusTimeBand = selectWeeklyFocusTimeBand(qualifyingSessions);
    const activity = buildWeeklyActivitySummary(windows.startDate, {
      mockExamDates: currentExams.map((row) => row.takenAt),
      qualifyingSessionDates: qualifyingSessions
        .map((row) => row.endedAt)
        .filter((value): value is Date => value != null),
      completedPlanTaskDates: currentTasks.map((row) => row.taskDate),
    });
    const previousStartDate = istanbulDate(windows.previous.start);
    const previousActivity = buildWeeklyActivitySummary(previousStartDate, {
      mockExamDates: previousExams.map((row) => row.takenAt),
      qualifyingSessionDates: previousQualifyingSessions
        .map((row) => row.endedAt)
        .filter((value): value is Date => value != null),
      completedPlanTaskDates: previousTasks.map((row) => row.taskDate),
    });
    const activeDays = activity.activeDays;
    const planSubjectBreakdown = weeklyPlanSubjectBreakdown(
      currentTasks,
      taxonomy,
    );
    const sessionSubjectBreakdown = weeklySessionSubjectBreakdown(
      qualifyingSessions,
      taxonomy,
    );
    const positiveComparison = selectPositiveWeeklyComparison(
      {
        focusMinutes,
        longestSessionMinutes,
        activeDays,
        completedTaskCount: completedPlanTaskCount,
      },
      {
        focusMinutes: totalFocusMinutes(previousQualifyingSessions),
        longestSessionMinutes: longestSession(previousQualifyingSessions),
        activeDays: previousActivity.activeDays,
        completedTaskCount: previousTasks.length,
      },
      {
        focusMinutes: comparisonMinFocusMinutesDelta,
        longestSessionMinutes: comparisonMinLongestSessionMinutesDelta,
        activeDays: comparisonMinActiveDaysDelta,
        completedTaskCount: comparisonMinPlanTasksDelta,
      },
    );
    const peakDay = weeklyPeakFocusDay(qualifyingSessions);
    const highlightCandidates: WeeklyHighlightCandidate[] = [
      ...(positiveComparison
        ? [{ kind: "POSITIVE_COMPARISON" as const, ...positiveComparison }]
        : []),
      ...(longestSessionMinutes > 0
        ? [{ kind: "LONGEST_SESSION" as const, minutes: longestSessionMinutes }]
        : []),
      ...(sessionSubjectBreakdown[0]
        ? [
            {
              kind: "TOP_FOCUS_SUBJECT" as const,
              subjectRef: sessionSubjectBreakdown[0].subjectRef,
              subjectName: sessionSubjectBreakdown[0].subjectName,
              focusMinutes: sessionSubjectBreakdown[0].focusMinutes,
            },
          ]
        : []),
      ...(planSubjectBreakdown[0]
        ? [
            {
              kind: "TOP_PLAN_SUBJECT" as const,
              ...planSubjectBreakdown[0],
            },
          ]
        : []),
      ...(peakDay ? [{ kind: "PEAK_FOCUS_DAY" as const, ...peakDay }] : []),
      ...(completedPlanTaskCount > 0
        ? [
            {
              kind: "COMPLETED_TASKS" as const,
              completedTaskCount: completedPlanTaskCount,
            },
          ]
        : []),
      ...(currentExams.length > 0
        ? [
            {
              kind: "MOCK_EXAMS" as const,
              mockExamCount: currentExams.length,
            },
          ]
        : []),
    ];
    const selectedHighlights = selectWeeklyHighlights(highlightCandidates);
    const evidenceChannelCount = [
      currentExams.length,
      completedSessionCount,
      completedPlanTaskCount,
    ].filter((count) => count > 0).length;
    const weeklyTitleId = selectWeeklyTitle(
      {
        status: recapStatus,
        longestActiveRun: activity.longestActiveRun,
        longestSessionMinutes,
        completedPlanTaskCount,
        focusedSubjectCount: sessionSubjectBreakdown.length,
        mockExamCount: currentExams.length,
        evidenceChannelCount,
      },
      {
        longestActiveRun: titleRhythmRunDays,
        longestSessionMinutes: titleDeepFocusMinutes,
        completedPlanTaskCount: titlePlanTaskCount,
        focusedSubjectCount: titleFocusedSubjectCount,
        mockExamCount: titleMockExamCount,
        evidenceChannelCount: titleBalancedChannelCount,
      },
    );
    const nextStorySignalKinds = selectWeeklyNextStorySignals({
      status: recapStatus,
      mockExamCount: currentExams.length,
      qualifyingSessionCount: completedSessionCount,
      completedPlanTaskCount,
    });
    const lang = I18nContext.current()?.lang;
    const t = (key: string, args?: Record<string, unknown>) =>
      this.i18n.translate(`coaching.weekly.${key}`, {
        lang,
        args,
      }) as unknown as string;
    const nextStorySignals = nextStorySignalKinds.map((kind) => ({
      kind,
      title: t(`NEXT_STORY_SIGNAL_${kind}_TITLE`),
      message: t(`NEXT_STORY_SIGNAL_${kind}`),
    }));

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
      recap: {
        status: recapStatus,
        activeDays,
        weeklyTitle:
          weeklyTitleId == null
            ? null
            : {
                id: weeklyTitleId,
                label: t(`TITLE_${weeklyTitleId}_LABEL`),
                message: t(`TITLE_${weeklyTitleId}_MESSAGE`, {
                  days: activity.longestActiveRun,
                  minutes: longestSessionMinutes,
                  tasks: completedPlanTaskCount,
                  subjects: sessionSubjectBreakdown.length,
                  exams: currentExams.length,
                  channels: evidenceChannelCount,
                }),
              },
        // Retained for older clients; new story surfaces render the full ordered list.
        nextStorySignal: nextStorySignals[0] ?? null,
        nextStorySignals,
        closingMessage: t(`RECAP_${recapStatus}`),
      },
      evidence: {
        mockExamCount: currentExams.length,
        completedSessionCount,
        qualifyingSessionCount: completedSessionCount,
        completedPlanTaskCount,
      },
      rhythm: {
        completedSessionCount,
        focusMinutes,
        activeDays,
        longestSessionMinutes,
        longestActiveRun: activity.longestActiveRun,
        focusTimeBand:
          focusTimeBand == null
            ? null
            : {
                ...focusTimeBand,
                label: t(`FOCUS_TIME_${focusTimeBand.id}_LABEL`),
                message: t(`FOCUS_TIME_${focusTimeBand.id}`, {
                  minutes: focusTimeBand.focusMinutes,
                  sessions: focusTimeBand.qualifyingSessionCount,
                }),
              },
        peakFocusDay:
          peakDay == null
            ? null
            : {
                ...peakDay,
                message: t("PEAK_FOCUS_DAY", {
                  minutes: peakDay.focusMinutes,
                }),
              },
        days: activity.days,
        subjectBreakdown: sessionSubjectBreakdown,
        moodCheckinCount: moods.length,
        energySignal: energy,
        message:
          completedSessionCount > 0
            ? t(energy ? `RHYTHM_${energy}` : "RHYTHM", {
                sessions: completedSessionCount,
                minutes: focusMinutes,
                days: activeDays,
              })
            : t("RHYTHM_EMPTY"),
      },
      plan: {
        completedTaskCount: completedPlanTaskCount,
        subjectBreakdown: planSubjectBreakdown,
        message:
          completedPlanTaskCount > 0
            ? t("PLAN", { tasks: completedPlanTaskCount })
            : t("PLAN_EMPTY"),
      },
      highlights: selectedHighlights.map((highlight) => ({
        ...highlight,
        message: highlightMessage(highlight, t),
      })),
      performance:
        currentAverage == null
          ? null
          : {
              mockExamCount: currentExams.length,
              averageNet: formatNet(currentAverage),
              previousWeekAverageNet:
                previousAverage == null ? null : formatNet(previousAverage),
              delta:
                previousAverage == null
                  ? null
                  : formatNetDelta(currentAverage - previousAverage),
              evidenceLevel: previousAverage == null ? "EARLY" : "COMPARABLE",
              message:
                previousAverage == null
                  ? t("PERFORMANCE_EARLY", { net: formatNet(currentAverage) })
                  : t(
                      currentAverage < previousAverage
                        ? "PERFORMANCE_COMPARABLE_DOWN"
                        : "PERFORMANCE_COMPARABLE",
                      {
                        net: formatNet(currentAverage),
                        delta: formatNetDelta(currentAverage - previousAverage),
                      },
                    ),
            },
      focus,
      suggestedTask: reviewSuggestedTask,
    };

    const suggestedTask = focusSelection?.subjectName
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
        examUpdated: evidence.exams.map((row) => [
          row.id,
          row.updatedAt.toISOString(),
        ]),
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
        sessionUpdated: evidence.sessions.map((row) => [
          row.id,
          row.updatedAt.toISOString(),
        ]),
        moodUpdated: evidence.moods.map((row) => [
          row.checkinDate,
          row.updatedAt.toISOString(),
        ]),
        taskUpdated: evidence.tasks.map((row) => [
          row.id,
          row.status,
          row.taskDate,
          row.updatedAt.toISOString(),
        ]),
        taxonomy: taxonomy.map((row) => [
          row.slug,
          row.name,
          row.questionCount,
        ]),
      },
    };
  }
}

function totalFocusMinutes(
  sessions: Array<{ actualFocusSeconds: number }>,
): number {
  return Math.round(
    sessions.reduce((sum, row) => sum + row.actualFocusSeconds, 0) / 60,
  );
}

function longestSession(
  sessions: Array<{ actualFocusSeconds: number }>,
): number {
  return Math.floor(
    sessions.reduce(
      (longest, row) => Math.max(longest, row.actualFocusSeconds),
      0,
    ) / 60,
  );
}

function highlightMessage(
  highlight: WeeklyHighlightCandidate,
  t: (key: string, args?: Record<string, unknown>) => string,
): string {
  switch (highlight.kind) {
    case "POSITIVE_COMPARISON":
      return t(`HIGHLIGHT_POSITIVE_${highlight.metric}`, {
        current: highlight.current,
        previous: highlight.previous,
        delta: highlight.delta,
      });
    case "LONGEST_SESSION":
      return t("HIGHLIGHT_LONGEST_SESSION", highlight);
    case "TOP_FOCUS_SUBJECT":
      return t("HIGHLIGHT_TOP_FOCUS_SUBJECT", {
        subject: highlight.subjectName,
        minutes: highlight.focusMinutes,
      });
    case "TOP_PLAN_SUBJECT":
      return t("HIGHLIGHT_TOP_PLAN_SUBJECT", {
        subject: highlight.subjectName,
        tasks: highlight.completedTaskCount,
      });
    case "PEAK_FOCUS_DAY":
      return t("HIGHLIGHT_PEAK_FOCUS_DAY", highlight);
    case "COMPLETED_TASKS":
      return t("HIGHLIGHT_COMPLETED_TASKS", {
        tasks: highlight.completedTaskCount,
      });
    case "MOCK_EXAMS":
      return t("HIGHLIGHT_MOCK_EXAMS", {
        exams: highlight.mockExamCount,
      });
  }
}
