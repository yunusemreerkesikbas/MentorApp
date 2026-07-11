export type WeeklyEnergySignal = "LOW" | "MIXED" | "STEADY";
export type WeeklyFocusSource =
  | "REPEATED_PHOTO_SIGNAL"
  | "WEEKLY_DECLINE"
  | "LOWEST_NORMALIZED"
  | "SESSION_RHYTHM";

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function weeklyReviewWindows(now = new Date()) {
  const local = new Date(now.getTime() + ISTANBUL_OFFSET_MS);
  const localDayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const currentWeekStartLocal =
    localDayStart - ((new Date(localDayStart).getUTCDay() + 6) % 7) * 24 * 60 * 60 * 1000;
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

export function isWeeklyReviewReady(mockExamCount: number, completedSessionCount: number): boolean {
  return mockExamCount >= 1 || completedSessionCount >= 2;
}

export function energySignal(moods: number[]): WeeklyEnergySignal | null {
  if (moods.length === 0) return null;
  const average = moods.reduce((sum, mood) => sum + mood, 0) / moods.length;
  if (average <= 2.5) return "LOW";
  if (average < 3.5) return "MIXED";
  return "STEADY";
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

function normalized(net: number | null, questionCount: number | null): number | null {
  return net == null || questionCount == null || questionCount <= 0
    ? null
    : (net / questionCount) * 100;
}

export function selectWeeklyFocus(
  subjects: WeeklySubjectInput[],
  photoSignals: WeeklyPhotoSignal[],
  hasMockExam: boolean,
): WeeklyFocusSelection | null {
  const byRef = new Map(subjects.map((subject) => [subject.subjectRef, subject]));
  const repeated = photoSignals
    .filter((signal) => signal.count >= 2 && byRef.has(signal.subjectRef))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const subjectA = byRef.get(a.subjectRef)!;
      const subjectB = byRef.get(b.subjectRef)!;
      return (
        (normalized(subjectA.currentAverageNet, subjectA.questionCount) ?? Infinity) -
          (normalized(subjectB.currentAverageNet, subjectB.questionCount) ?? Infinity) ||
        a.subjectRef.localeCompare(b.subjectRef)
      );
    })[0];
  if (repeated) {
    const subject = byRef.get(repeated.subjectRef)!;
    return { source: "REPEATED_PHOTO_SIGNAL", subjectRef: subject.subjectRef, subjectName: subject.subjectName };
  }

  const comparable = subjects
    .map((subject) => {
      const current = normalized(subject.currentAverageNet, subject.questionCount);
      const previous = normalized(subject.previousAverageNet, subject.questionCount);
      return { subject, current, delta: current == null || previous == null ? null : current - previous };
    })
    .filter((row) => row.delta != null && row.delta < 0)
    .sort((a, b) => a.delta! - b.delta! || a.subject.subjectRef.localeCompare(b.subject.subjectRef))[0];
  if (comparable) {
    return { source: "WEEKLY_DECLINE", subjectRef: comparable.subject.subjectRef, subjectName: comparable.subject.subjectName };
  }

  const lowest = subjects
    .map((subject) => ({ subject, value: normalized(subject.currentAverageNet, subject.questionCount) }))
    .filter((row): row is { subject: WeeklySubjectInput; value: number } => row.value != null)
    .sort((a, b) => a.value - b.value || a.subject.subjectRef.localeCompare(b.subject.subjectRef))[0];
  if (lowest) {
    return { source: "LOWEST_NORMALIZED", subjectRef: lowest.subject.subjectRef, subjectName: lowest.subject.subjectName };
  }

  return hasMockExam ? null : { source: "SESSION_RHYTHM", subjectRef: null, subjectName: null };
}

