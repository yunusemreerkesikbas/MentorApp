export type WeeklyEnergySignal = "LOW" | "MIXED" | "STEADY";
export type WeeklyRecapStatus = "EMPTY" | "PARTIAL" | "READY";
export type WeeklyFocusSource =
  | "REPEATED_PHOTO_SIGNAL"
  | "WEEKLY_DECLINE"
  | "LOWEST_NORMALIZED"
  | "SESSION_RHYTHM";

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function weeklyReviewWindows(now = new Date()) {
  const local = new Date(now.getTime() + ISTANBUL_OFFSET_MS);
  const localDayStart = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );
  const currentWeekStartLocal =
    localDayStart -
    ((new Date(localDayStart).getUTCDay() + 6) % 7) * 24 * 60 * 60 * 1000;
  const currentEnd = new Date(currentWeekStartLocal - ISTANBUL_OFFSET_MS);
  const currentStart = new Date(currentEnd.getTime() - WEEK_MS);
  const previousStart = new Date(currentStart.getTime() - WEEK_MS);
  const localDate = (date: Date) =>
    new Date(date.getTime() + ISTANBUL_OFFSET_MS).toISOString().slice(0, 10);

  return {
    current: { start: currentStart, end: currentEnd },
    previous: { start: previousStart, end: currentStart },
    startDate: localDate(currentStart),
    endDate: localDate(new Date(currentEnd.getTime() - 1)),
  };
}

export interface WeeklyRecapEvidenceCounts {
  mockExamCount: number;
  qualifyingSessionCount: number;
  completedPlanTaskCount: number;
}

export interface WeeklyRecapReadyThresholds {
  mockExamCount: number;
  qualifyingSessionCount: number;
  completedPlanTaskCount: number;
}

export type WeeklyNextStorySignalKind =
  | "FOCUS_SESSION"
  | "PLAN_TASK"
  | "MOCK_EXAM";

export function selectWeeklyNextStorySignals({
  status,
  mockExamCount,
  qualifyingSessionCount,
  completedPlanTaskCount,
}: WeeklyRecapEvidenceCounts & {
  status: WeeklyRecapStatus;
}): WeeklyNextStorySignalKind[] {
  if (status !== "PARTIAL") return [];

  return [
    ...(qualifyingSessionCount === 0
      ? (["FOCUS_SESSION"] as const)
      : []),
    ...(completedPlanTaskCount === 0 ? (["PLAN_TASK"] as const) : []),
    ...(mockExamCount === 0 ? (["MOCK_EXAM"] as const) : []),
  ];
}

const DEFAULT_RECAP_THRESHOLDS: WeeklyRecapReadyThresholds = {
  mockExamCount: 1,
  qualifyingSessionCount: 2,
  completedPlanTaskCount: 3,
};

export function weeklyRecapStatus(
  evidence: WeeklyRecapEvidenceCounts,
  thresholds: WeeklyRecapReadyThresholds,
): WeeklyRecapStatus {
  if (
    evidence.mockExamCount >= thresholds.mockExamCount ||
    evidence.qualifyingSessionCount >= thresholds.qualifyingSessionCount ||
    evidence.completedPlanTaskCount >= thresholds.completedPlanTaskCount
  ) {
    return "READY";
  }

  return evidence.mockExamCount +
    evidence.qualifyingSessionCount +
    evidence.completedPlanTaskCount >
    0
    ? "PARTIAL"
    : "EMPTY";
}

export function isWeeklyReviewReady(
  mockExamCount: number,
  completedSessionCount: number,
  completedPlanTaskCount = 0,
  thresholds = DEFAULT_RECAP_THRESHOLDS,
): boolean {
  return (
    weeklyRecapStatus(
      {
        mockExamCount,
        qualifyingSessionCount: completedSessionCount,
        completedPlanTaskCount,
      },
      thresholds,
    ) === "READY"
  );
}

interface WeeklyRecapActiveDayInput {
  mockExamDates: Date[];
  qualifyingSessionDates: Date[];
  completedPlanTaskDates: string[];
}

export interface WeeklyRecapDay {
  date: string;
  active: boolean;
}

export interface WeeklyActivitySummary {
  activeDays: number;
  longestActiveRun: number;
  days: WeeklyRecapDay[];
}

export type WeeklyFocusTimeBandId =
  | "MORNING"
  | "AFTERNOON"
  | "EVENING"
  | "NIGHT";

interface WeeklyFocusTimeSession {
  startedAt: Date;
  actualFocusSeconds: number;
}

interface WeeklyPeakFocusSession {
  endedAt: Date | null;
  actualFocusSeconds: number;
}

export interface WeeklyFocusTimeBandSummary {
  id: WeeklyFocusTimeBandId;
  focusMinutes: number;
  qualifyingSessionCount: number;
}

export interface WeeklyPeakFocusDay {
  date: string;
  focusMinutes: number;
}

const FOCUS_TIME_BAND_ORDER: WeeklyFocusTimeBandId[] = [
  "MORNING",
  "AFTERNOON",
  "EVENING",
  "NIGHT",
];

export function istanbulFocusTimeBand(
  date: Date,
): WeeklyFocusTimeBandId {
  const hour = new Date(date.getTime() + ISTANBUL_OFFSET_MS).getUTCHours();
  if (hour >= 5 && hour < 12) return "MORNING";
  if (hour >= 12 && hour < 17) return "AFTERNOON";
  if (hour >= 17 && hour < 22) return "EVENING";
  return "NIGHT";
}

export function selectWeeklyFocusTimeBand(
  sessions: WeeklyFocusTimeSession[],
): WeeklyFocusTimeBandSummary | null {
  const aggregates = new Map<
    WeeklyFocusTimeBandId,
    { focusSeconds: number; qualifyingSessionCount: number }
  >();
  for (const session of sessions) {
    const id = istanbulFocusTimeBand(session.startedAt);
    const aggregate = aggregates.get(id) ?? {
      focusSeconds: 0,
      qualifyingSessionCount: 0,
    };
    aggregate.focusSeconds += session.actualFocusSeconds;
    aggregate.qualifyingSessionCount += 1;
    aggregates.set(id, aggregate);
  }

  const winner = FOCUS_TIME_BAND_ORDER.reduce<{
    id: WeeklyFocusTimeBandId;
    focusSeconds: number;
    qualifyingSessionCount: number;
  } | null>((best, id) => {
    const aggregate = aggregates.get(id);
    if (!aggregate || aggregate.focusSeconds <= (best?.focusSeconds ?? 0)) {
      return best;
    }
    return { id, ...aggregate };
  }, null);
  if (!winner) return null;
  return {
    id: winner.id,
    focusMinutes: Math.round(winner.focusSeconds / 60),
    qualifyingSessionCount: winner.qualifyingSessionCount,
  };
}

export function weeklyPeakFocusDay(
  sessions: WeeklyPeakFocusSession[],
): WeeklyPeakFocusDay | null {
  const secondsByDate = new Map<string, number>();
  for (const session of sessions) {
    if (!session.endedAt) continue;
    const date = istanbulDate(session.endedAt);
    secondsByDate.set(
      date,
      (secondsByDate.get(date) ?? 0) + session.actualFocusSeconds,
    );
  }
  const peak = [...secondsByDate.entries()].sort(
    ([dateA, secondsA], [dateB, secondsB]) =>
      secondsB - secondsA || dateA.localeCompare(dateB),
  )[0];
  return peak
    ? { date: peak[0], focusMinutes: Math.round(peak[1] / 60) }
    : null;
}

export function buildWeeklyActivitySummary(
  startDate: string,
  input: WeeklyRecapActiveDayInput,
): WeeklyActivitySummary {
  const activeDates = new Set([
    ...input.mockExamDates.map(istanbulDate),
    ...input.qualifyingSessionDates.map(istanbulDate),
    ...input.completedPlanTaskDates,
  ]);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addIsoDays(startDate, index);
    return { date, active: activeDates.has(date) };
  });
  let longestActiveRun = 0;
  let currentRun = 0;
  for (const day of days) {
    currentRun = day.active ? currentRun + 1 : 0;
    longestActiveRun = Math.max(longestActiveRun, currentRun);
  }

  return {
    activeDays: days.filter((day) => day.active).length,
    longestActiveRun,
    days,
  };
}

export function countWeeklyRecapActiveDays(
  input: WeeklyRecapActiveDayInput,
): number {
  return new Set([
    ...input.mockExamDates.map(istanbulDate),
    ...input.qualifyingSessionDates.map(istanbulDate),
    ...input.completedPlanTaskDates,
  ]).size;
}

interface WeeklyPlanTaskSubject {
  subject: string | null;
}

interface WeeklyTaxonomySubject {
  slug: string;
  name: string;
}

interface WeeklySessionSubject {
  subject: string | null;
  actualFocusSeconds: number;
}

export interface WeeklySessionSubjectBreakdown {
  subjectRef: string;
  subjectName: string;
  focusMinutes: number;
  qualifyingSessionCount: number;
}

export function weeklySessionSubjectBreakdown(
  sessions: WeeklySessionSubject[],
  taxonomy: WeeklyTaxonomySubject[],
): WeeklySessionSubjectBreakdown[] {
  const taxonomyByKey = new Map<string, WeeklyTaxonomySubject>();
  const taxonomyIndex = new Map<string, number>();
  for (const [index, subject] of taxonomy.entries()) {
    taxonomyByKey.set(normalizeSubject(subject.slug), subject);
    taxonomyByKey.set(normalizeSubject(subject.name), subject);
    taxonomyIndex.set(subject.slug, index);
  }

  const aggregates = new Map<
    string,
    { seconds: number; qualifyingSessionCount: number }
  >();
  for (const session of sessions) {
    if (!session.subject) continue;
    const subject = taxonomyByKey.get(normalizeSubject(session.subject));
    if (!subject) continue;
    const aggregate = aggregates.get(subject.slug) ?? {
      seconds: 0,
      qualifyingSessionCount: 0,
    };
    aggregate.seconds += session.actualFocusSeconds;
    aggregate.qualifyingSessionCount += 1;
    aggregates.set(subject.slug, aggregate);
  }

  return taxonomy
    .filter((subject) => aggregates.has(subject.slug))
    .map((subject) => {
      const aggregate = aggregates.get(subject.slug)!;
      return {
        subjectRef: subject.slug,
        subjectName: subject.name,
        focusMinutes: Math.round(aggregate.seconds / 60),
        qualifyingSessionCount: aggregate.qualifyingSessionCount,
        focusSeconds: aggregate.seconds,
      };
    })
    .sort(
      (a, b) =>
        b.focusSeconds - a.focusSeconds ||
        (taxonomyIndex.get(a.subjectRef) ?? 0) -
          (taxonomyIndex.get(b.subjectRef) ?? 0),
    )
    .map(({ focusSeconds: _focusSeconds, ...subject }) => subject);
}

export interface WeeklyPlanSubjectBreakdown {
  subjectRef: string;
  subjectName: string;
  completedTaskCount: number;
}

export function weeklyPlanSubjectBreakdown(
  tasks: WeeklyPlanTaskSubject[],
  taxonomy: WeeklyTaxonomySubject[],
): WeeklyPlanSubjectBreakdown[] {
  const taxonomyByKey = new Map<string, WeeklyTaxonomySubject>();
  for (const subject of taxonomy) {
    taxonomyByKey.set(normalizeSubject(subject.slug), subject);
    taxonomyByKey.set(normalizeSubject(subject.name), subject);
  }

  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (!task.subject) continue;
    const subject = taxonomyByKey.get(normalizeSubject(task.subject));
    if (!subject) continue;
    counts.set(subject.slug, (counts.get(subject.slug) ?? 0) + 1);
  }

  return taxonomy
    .filter((subject) => counts.has(subject.slug))
    .map((subject) => ({
      subjectRef: subject.slug,
      subjectName: subject.name,
      completedTaskCount: counts.get(subject.slug)!,
    }))
    .sort(
      (a, b) =>
        b.completedTaskCount - a.completedTaskCount ||
        a.subjectName.localeCompare(b.subjectName, "tr"),
    );
}

export function energySignal(moods: number[]): WeeklyEnergySignal | null {
  if (moods.length === 0) return null;
  const average = moods.reduce((sum, mood) => sum + mood, 0) / moods.length;
  if (average <= 2.5) return "LOW";
  if (average < 3.5) return "MIXED";
  return "STEADY";
}

export interface WeeklyComparisonTotals {
  focusMinutes: number;
  longestSessionMinutes: number;
  activeDays: number;
  completedTaskCount: number;
}

export interface WeeklyComparisonThresholds {
  focusMinutes: number;
  longestSessionMinutes: number;
  activeDays: number;
  completedTaskCount: number;
}

export type WeeklyPositiveComparisonMetric =
  | "ACTIVE_DAYS"
  | "FOCUS_MINUTES"
  | "COMPLETED_TASKS"
  | "LONGEST_SESSION";

export interface WeeklyPositiveComparison {
  metric: WeeklyPositiveComparisonMetric;
  current: number;
  previous: number;
  delta: number;
}

export function selectPositiveWeeklyComparison(
  current: WeeklyComparisonTotals,
  previous: WeeklyComparisonTotals,
  thresholds: WeeklyComparisonThresholds,
): WeeklyPositiveComparison | null {
  const candidates = [
    comparisonCandidate(
      "ACTIVE_DAYS",
      current.activeDays,
      previous.activeDays,
      thresholds.activeDays,
    ),
    comparisonCandidate(
      "FOCUS_MINUTES",
      current.focusMinutes,
      previous.focusMinutes,
      thresholds.focusMinutes,
    ),
    comparisonCandidate(
      "COMPLETED_TASKS",
      current.completedTaskCount,
      previous.completedTaskCount,
      thresholds.completedTaskCount,
    ),
    comparisonCandidate(
      "LONGEST_SESSION",
      current.longestSessionMinutes,
      previous.longestSessionMinutes,
      thresholds.longestSessionMinutes,
    ),
  ].filter(
    (
      candidate,
    ): candidate is WeeklyPositiveComparison & { score: number } =>
      candidate != null,
  );

  const winner = candidates.reduce<
    (WeeklyPositiveComparison & { score: number }) | null
  >(
    (best, candidate) =>
      best == null || candidate.score > best.score ? candidate : best,
    null,
  );
  if (!winner) return null;
  const { score: _score, ...comparison } = winner;
  return comparison;
}

export type WeeklyTitleId =
  | "BALANCE_MASTER"
  | "RHYTHM_GUARDIAN"
  | "FOCUS_DIVER"
  | "PLAN_ARCHITECT"
  | "SUBJECT_EXPLORER"
  | "MOCK_BRAVE"
  | "FOCUS_TRAVELER";

export interface WeeklyTitleEvidence {
  status: WeeklyRecapStatus;
  longestActiveRun: number;
  longestSessionMinutes: number;
  completedPlanTaskCount: number;
  focusedSubjectCount: number;
  mockExamCount: number;
  evidenceChannelCount: number;
}

export interface WeeklyTitleThresholds {
  longestActiveRun: number;
  longestSessionMinutes: number;
  completedPlanTaskCount: number;
  focusedSubjectCount: number;
  mockExamCount: number;
  evidenceChannelCount: number;
}

export function selectWeeklyTitle(
  evidence: WeeklyTitleEvidence,
  thresholds: WeeklyTitleThresholds,
): WeeklyTitleId | null {
  if (evidence.status !== "READY") return null;

  const candidates: Array<{
    id: Exclude<WeeklyTitleId, "FOCUS_TRAVELER">;
    observed: number;
    threshold: number;
  }> = (
    [
    {
      id: "BALANCE_MASTER",
      observed: evidence.evidenceChannelCount,
      threshold: thresholds.evidenceChannelCount,
    },
    {
      id: "RHYTHM_GUARDIAN",
      observed: evidence.longestActiveRun,
      threshold: thresholds.longestActiveRun,
    },
    {
      id: "FOCUS_DIVER",
      observed: evidence.longestSessionMinutes,
      threshold: thresholds.longestSessionMinutes,
    },
    {
      id: "PLAN_ARCHITECT",
      observed: evidence.completedPlanTaskCount,
      threshold: thresholds.completedPlanTaskCount,
    },
    {
      id: "SUBJECT_EXPLORER",
      observed: evidence.focusedSubjectCount,
      threshold: thresholds.focusedSubjectCount,
    },
    {
      id: "MOCK_BRAVE",
      observed: evidence.mockExamCount,
      threshold: thresholds.mockExamCount,
    },
    ] satisfies Array<{
      id: Exclude<WeeklyTitleId, "FOCUS_TRAVELER">;
      observed: number;
      threshold: number;
    }>
  ).filter(
    (candidate) =>
      candidate.threshold > 0 && candidate.observed >= candidate.threshold,
  );
  const winner = candidates.reduce<(typeof candidates)[number] | null>(
    (best, candidate) =>
      best == null ||
      candidate.observed / candidate.threshold >
        best.observed / best.threshold
        ? candidate
        : best,
    null,
  );

  return winner?.id ?? "FOCUS_TRAVELER";
}

export type WeeklyHighlightCandidate =
  | ({
      kind: "POSITIVE_COMPARISON";
    } & WeeklyPositiveComparison)
  | { kind: "LONGEST_SESSION"; minutes: number }
  | {
      kind: "TOP_FOCUS_SUBJECT";
      subjectRef: string;
      subjectName: string;
      focusMinutes: number;
    }
  | {
      kind: "TOP_PLAN_SUBJECT";
      subjectRef: string;
      subjectName: string;
      completedTaskCount: number;
    }
  | { kind: "PEAK_FOCUS_DAY"; date: string; focusMinutes: number }
  | { kind: "COMPLETED_TASKS"; completedTaskCount: number }
  | { kind: "MOCK_EXAMS"; mockExamCount: number };

const WEEKLY_HIGHLIGHT_PRIORITY: Record<
  WeeklyHighlightCandidate["kind"],
  number
> = {
  POSITIVE_COMPARISON: 0,
  LONGEST_SESSION: 1,
  TOP_FOCUS_SUBJECT: 2,
  TOP_PLAN_SUBJECT: 3,
  PEAK_FOCUS_DAY: 4,
  COMPLETED_TASKS: 5,
  MOCK_EXAMS: 6,
};

export function selectWeeklyHighlights(
  candidates: WeeklyHighlightCandidate[],
): WeeklyHighlightCandidate[] {
  return [...candidates]
    .sort(
      (a, b) =>
        WEEKLY_HIGHLIGHT_PRIORITY[a.kind] -
        WEEKLY_HIGHLIGHT_PRIORITY[b.kind],
    )
    .slice(0, 2);
}

interface WeeklySubjectInput {
  subjectRef: string;
  subjectName: string;
  questionCount: number | null;
  currentAverageNet: number | null;
  previousAverageNet: number | null;
}

interface WeeklyPhotoSignal {
  subjectRef: string;
  count: number;
}

export interface WeeklyFocusSelection {
  source: WeeklyFocusSource;
  subjectRef: string | null;
  subjectName: string | null;
}

function normalized(
  net: number | null,
  questionCount: number | null,
): number | null {
  return net == null || questionCount == null || questionCount <= 0
    ? null
    : (net / questionCount) * 100;
}

export function selectWeeklyFocus(
  subjects: WeeklySubjectInput[],
  photoSignals: WeeklyPhotoSignal[],
  hasMockExam: boolean,
): WeeklyFocusSelection | null {
  const byRef = new Map(
    subjects.map((subject) => [subject.subjectRef, subject]),
  );
  const repeated = photoSignals
    .filter((signal) => signal.count >= 2 && byRef.has(signal.subjectRef))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const subjectA = byRef.get(a.subjectRef)!;
      const subjectB = byRef.get(b.subjectRef)!;
      return (
        (normalized(subjectA.currentAverageNet, subjectA.questionCount) ??
          Infinity) -
          (normalized(subjectB.currentAverageNet, subjectB.questionCount) ??
            Infinity) || a.subjectRef.localeCompare(b.subjectRef)
      );
    })[0];
  if (repeated) {
    const subject = byRef.get(repeated.subjectRef)!;
    return {
      source: "REPEATED_PHOTO_SIGNAL",
      subjectRef: subject.subjectRef,
      subjectName: subject.subjectName,
    };
  }

  const comparable = subjects
    .map((subject) => {
      const current = normalized(
        subject.currentAverageNet,
        subject.questionCount,
      );
      const previous = normalized(
        subject.previousAverageNet,
        subject.questionCount,
      );
      return {
        subject,
        current,
        delta: current == null || previous == null ? null : current - previous,
      };
    })
    .filter((row) => row.delta != null && row.delta < 0)
    .sort(
      (a, b) =>
        a.delta! - b.delta! ||
        a.subject.subjectRef.localeCompare(b.subject.subjectRef),
    )[0];
  if (comparable) {
    return {
      source: "WEEKLY_DECLINE",
      subjectRef: comparable.subject.subjectRef,
      subjectName: comparable.subject.subjectName,
    };
  }

  const lowest = subjects
    .map((subject) => ({
      subject,
      value: normalized(subject.currentAverageNet, subject.questionCount),
    }))
    .filter(
      (row): row is { subject: WeeklySubjectInput; value: number } =>
        row.value != null,
    )
    .sort(
      (a, b) =>
        a.value - b.value ||
        a.subject.subjectRef.localeCompare(b.subject.subjectRef),
    )[0];
  if (lowest) {
    return {
      source: "LOWEST_NORMALIZED",
      subjectRef: lowest.subject.subjectRef,
      subjectName: lowest.subject.subjectName,
    };
  }

  return hasMockExam
    ? null
    : { source: "SESSION_RHYTHM", subjectRef: null, subjectName: null };
}

export function istanbulDate(date: Date): string {
  return new Date(date.getTime() + ISTANBUL_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function addIsoDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function comparisonCandidate(
  metric: WeeklyPositiveComparisonMetric,
  current: number,
  previous: number,
  threshold: number,
): (WeeklyPositiveComparison & { score: number }) | null {
  const delta = current - previous;
  return threshold > 0 && delta >= threshold
    ? { metric, current, previous, delta, score: delta / threshold }
    : null;
}

function normalizeSubject(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR");
}
