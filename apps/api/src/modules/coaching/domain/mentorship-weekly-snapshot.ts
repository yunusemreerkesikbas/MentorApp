import type {
  MentorshipWeeklyMockSubjectDto,
  MentorshipWeeklySnapshotDto,
  MentorshipWeeklySubjectDto,
} from "@mentor/types";
import {
  buildMentorshipWeeklyComparison,
  type MentorshipWeekPeriod,
  type MentorshipWeeklyTotals,
} from "./mentorship-weekly-report";
import { buildWeeklyActivitySummary, istanbulDate } from "./weekly-review";

export interface MentorshipWeeklyRawEvidence {
  sessions: Array<{
    endedAt: Date;
    focusSeconds: number;
    subject: string | null;
  }>;
  tasks: Array<{ taskDate: string; status: string }>;
  mocks: Array<{
    examId: string;
    examName: string;
    takenAt: Date;
    totalNet: number;
    publisherName: string | null;
    subjects: Array<{ subjectRef: string; net: number }>;
  }>;
}

function inRange(value: string, startDate: string, endDate: string): boolean {
  return value >= startDate && value <= endDate;
}

function totals(
  period: { startDate: string; endDate: string },
  evidence: MentorshipWeeklyRawEvidence,
): MentorshipWeeklyTotals {
  const sessions = evidence.sessions.filter((row) =>
    inRange(istanbulDate(row.endedAt), period.startDate, period.endDate),
  );
  const tasks = evidence.tasks.filter((row) =>
    inRange(row.taskDate, period.startDate, period.endDate),
  );
  const mocks = evidence.mocks.filter((row) =>
    inRange(istanbulDate(row.takenAt), period.startDate, period.endDate),
  );
  const activity = buildWeeklyActivitySummary(period.startDate, {
    qualifyingSessionDates: sessions.map((row) => row.endedAt),
    completedPlanTaskDates: tasks
      .filter((row) => row.status === "DONE")
      .map((row) => row.taskDate),
    mockExamDates: mocks.map((row) => row.takenAt),
  });

  return {
    focusMinutes: Math.round(
      sessions.reduce((sum, row) => sum + row.focusSeconds, 0) / 60,
    ),
    sessions: sessions.length,
    activeDays: activity.activeDays,
    plannedTasks: tasks.length,
    completedTasks: tasks.filter((row) => row.status === "DONE").length,
  };
}

function subjectBreakdown(
  period: MentorshipWeekPeriod,
  evidence: MentorshipWeeklyRawEvidence,
): MentorshipWeeklySubjectDto[] {
  const bySubject = new Map<
    string | null,
    {
      currentSeconds: number;
      currentSessions: number;
      previousSeconds: number;
      previousSessions: number;
    }
  >();
  for (const row of evidence.sessions) {
    const date = istanbulDate(row.endedAt);
    const bucket = inRange(date, period.startDate, period.endDate)
      ? "current"
      : inRange(date, period.previousStartDate, period.previousEndDate)
        ? "previous"
        : null;
    if (bucket === null) continue;
    const value = bySubject.get(row.subject) ?? {
      currentSeconds: 0,
      currentSessions: 0,
      previousSeconds: 0,
      previousSessions: 0,
    };
    if (bucket === "current") {
      value.currentSeconds += row.focusSeconds;
      value.currentSessions += 1;
    } else {
      value.previousSeconds += row.focusSeconds;
      value.previousSessions += 1;
    }
    bySubject.set(row.subject, value);
  }

  return [...bySubject]
    .map(([subjectRef, value]) => ({
      subjectRef,
      currentFocusMinutes: Math.round(value.currentSeconds / 60),
      currentSessions: value.currentSessions,
      previousFocusMinutes: Math.round(value.previousSeconds / 60),
      previousSessions: value.previousSessions,
    }))
    .sort((a, b) => {
      if (a.subjectRef === null) return 1;
      if (b.subjectRef === null) return -1;
      return a.subjectRef.localeCompare(b.subjectRef);
    });
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return (
    Math.round(
      (values.reduce((sum, value) => sum + value, 0) / values.length) * 100,
    ) / 100
  );
}

function mockSummary(
  period: MentorshipWeekPeriod,
  evidence: MentorshipWeeklyRawEvidence,
) {
  const currentCandidates = evidence.mocks.filter((row) =>
    inRange(istanbulDate(row.takenAt), period.startDate, period.endDate),
  );
  const previousCandidates = evidence.mocks.filter((row) =>
    inRange(
      istanbulDate(row.takenAt),
      period.previousStartDate,
      period.previousEndDate,
    ),
  );
  const scope = [...currentCandidates, ...previousCandidates].sort(
    (a, b) =>
      b.takenAt.getTime() - a.takenAt.getTime() ||
      a.examId.localeCompare(b.examId),
  )[0];
  const current = scope
    ? currentCandidates.filter((row) => row.examId === scope.examId)
    : [];
  const previous = scope
    ? previousCandidates.filter((row) => row.examId === scope.examId)
    : [];
  const subjectRefs = new Set(
    [...current, ...previous].flatMap((mock) =>
      mock.subjects.map((subject) => subject.subjectRef),
    ),
  );
  const subjects: MentorshipWeeklyMockSubjectDto[] = [...subjectRefs]
    .sort()
    .map((subjectRef) => {
      const currentNets = current.flatMap((mock) =>
        mock.subjects
          .filter((row) => row.subjectRef === subjectRef)
          .map((row) => row.net),
      );
      const previousNets = previous.flatMap((mock) =>
        mock.subjects
          .filter((row) => row.subjectRef === subjectRef)
          .map((row) => row.net),
      );
      return {
        subjectRef,
        currentAverageNet: average(currentNets),
        previousAverageNet: average(previousNets),
        currentAttemptCount: currentNets.length,
        previousAttemptCount: previousNets.length,
      };
    });

  return {
    examScopeName: scope?.examName ?? null,
    currentAttemptCount: current.length,
    previousAttemptCount: previous.length,
    currentAverageNet: average(current.map((row) => row.totalNet)),
    previousAverageNet: average(previous.map((row) => row.totalNet)),
    currentPublishers: [
      ...new Set(
        current.map((row) => row.publisherName).filter(Boolean) as string[],
      ),
    ].sort((a, b) => a.localeCompare(b, "tr")),
    previousPublishers: [
      ...new Set(
        previous.map((row) => row.publisherName).filter(Boolean) as string[],
      ),
    ].sort((a, b) => a.localeCompare(b, "tr")),
    subjects,
  };
}

export function buildMentorshipWeeklySnapshot(
  period: MentorshipWeekPeriod,
  raw: MentorshipWeeklyRawEvidence,
): MentorshipWeeklySnapshotDto {
  const comparison = buildMentorshipWeeklyComparison(
    totals({ startDate: period.startDate, endDate: period.endDate }, raw),
    totals(
      { startDate: period.previousStartDate, endDate: period.previousEndDate },
      raw,
    ),
  );
  const mocks = mockSummary(period, raw);
  comparison.current.hasRecordedActivity ||= mocks.currentAttemptCount > 0;
  comparison.previous.hasRecordedActivity ||= mocks.previousAttemptCount > 0;
  const subjects = subjectBreakdown(period, raw);
  const limitations: MentorshipWeeklySnapshotDto["limitations"] = [];
  if (!comparison.current.hasRecordedActivity)
    limitations.push("NO_CURRENT_ACTIVITY");
  if (!comparison.previous.hasRecordedActivity)
    limitations.push("NO_PREVIOUS_ACTIVITY");
  if (mocks.currentAttemptCount === 0) limitations.push("NO_CURRENT_MOCK");
  if (mocks.previousAttemptCount === 0) limitations.push("NO_PREVIOUS_MOCK");
  const reportMockScopes = new Set(
    raw.mocks
      .filter((mock) =>
        inRange(
          istanbulDate(mock.takenAt),
          period.previousStartDate,
          period.endDate,
        ),
      )
      .map((mock) => mock.examId),
  );
  if (reportMockScopes.size > 1) {
    limitations.push("MIXED_MOCK_SCOPE");
  }
  if (subjects.some((row) => row.subjectRef === null))
    limitations.push("UNCLASSIFIED_SESSIONS");

  return {
    period,
    ...comparison,
    subjects,
    mocks,
    evidence: [
      {
        id: "focus_minutes",
        kind: "FOCUS_MINUTES",
        current: comparison.current.focusMinutes,
        previous: comparison.previous.focusMinutes,
        delta: comparison.deltas.focusMinutes,
      },
      {
        id: "sessions",
        kind: "SESSIONS",
        current: comparison.current.sessions,
        previous: comparison.previous.sessions,
        delta: comparison.deltas.sessions,
      },
      {
        id: "active_days",
        kind: "ACTIVE_DAYS",
        current: comparison.current.activeDays,
        previous: comparison.previous.activeDays,
        delta: comparison.deltas.activeDays,
      },
      {
        id: "planned_tasks",
        kind: "PLANNED_TASKS",
        current: comparison.current.plannedTasks,
        previous: comparison.previous.plannedTasks,
        delta: comparison.deltas.plannedTasks,
      },
      {
        id: "completed_tasks",
        kind: "COMPLETED_TASKS",
        current: comparison.current.completedTasks,
        previous: comparison.previous.completedTasks,
        delta: comparison.deltas.completedTasks,
      },
      {
        id: "completion_rate",
        kind: "COMPLETION_RATE",
        current: comparison.current.completionRate,
        previous: comparison.previous.completionRate,
        delta: comparison.deltas.completionRate,
      },
      {
        id: "mock_average",
        kind: "MOCK_AVERAGE",
        current: mocks.currentAverageNet,
        previous: mocks.previousAverageNet,
        delta:
          mocks.currentAverageNet === null || mocks.previousAverageNet === null
            ? null
            : mocks.currentAverageNet - mocks.previousAverageNet,
      },
    ],
    limitations,
  };
}
