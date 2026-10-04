import {
  PLAN_ADAPTATION_MINUTES,
  PLAN_ADAPTATION_MINUTES_MAX,
  PLAN_ADAPTATION_MINUTES_MIN,
} from "@mentor/validation";

export const PLAN_ADAPTATION_NOTE_MAX = 500;
/** The API's own presets, so the brief's suggestion always lands on a card. */
export const PLAN_ADAPTATION_MINUTE_CHOICES = PLAN_ADAPTATION_MINUTES;

export interface PlanAdaptationKnownWeek {
  pendingCount: number;
  subjects: readonly string[];
}

interface PendingWeekTask {
  status: string;
  subject: string | null;
}

function subjectKey(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR");
}

export function summarizePendingWeek(
  weekTasks: Record<string, readonly PendingWeekTask[]>,
): PlanAdaptationKnownWeek {
  const subjects: string[] = [];
  const seen = new Set<string>();
  let pendingCount = 0;
  for (const tasks of Object.values(weekTasks)) {
    for (const task of tasks) {
      if (task.status !== "PENDING") continue;
      pendingCount += 1;
      const subject = task.subject?.trim();
      if (!subject) continue;
      const key = subjectKey(subject);
      if (seen.has(key)) continue;
      seen.add(key);
      subjects.push(subject);
    }
  }
  return { pendingCount, subjects };
}

/** Taxonomy order, case-insensitive match against this week's pending subjects. */
export function seedBriefSubjects(
  options: readonly string[],
  known: readonly string[],
): string[] {
  const knownKeys = new Set(known.map(subjectKey));
  return options
    .map((name) => name.trim())
    .filter((name) => name && knownKeys.has(subjectKey(name)));
}

/** A minute count the API takes, typed or picked. */
export function isMinuteEntry(value: number | null): value is number {
  return (
    value != null &&
    Number.isInteger(value) &&
    value >= PLAN_ADAPTATION_MINUTES_MIN &&
    value <= PLAN_ADAPTATION_MINUTES_MAX
  );
}

/** The plan window as the student sees it: today and the next six days, ISO weekday 1 = Monday. */
export interface PlanWindowDay {
  weekday: number;
  date: Date;
}

export function planWindowDays(today: Date): PlanWindowDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index);
    return { weekday: ((date.getDay() + 6) % 7) + 1, date };
  });
}

export function formatKnownBrief(parts: {
  exam: string | null;
  goal: string | null;
  pending: string | null;
}): string | null {
  const line = [parts.exam, parts.goal, parts.pending].filter(Boolean).join(" · ");
  return line || null;
}
