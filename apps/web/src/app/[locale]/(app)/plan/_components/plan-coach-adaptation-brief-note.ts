import { PLAN_ADAPTATION_MINUTES } from "@mentor/validation";

export const PLAN_ADAPTATION_NOTE_MAX = 500;
export const PLAN_ADAPTATION_DAY_CHOICES = [3, 4, 5, 6, 7] as const;
/** The API's own list, so the brief's suggestion always lands on a card. */
export const PLAN_ADAPTATION_MINUTE_CHOICES = PLAN_ADAPTATION_MINUTES;
export const PLAN_ADAPTATION_SUBJECT_CAP = 3;

export interface PlanAdaptationBriefAnswers {
  days: number | null;
  minutes: number | null;
  subjects: readonly string[];
  note: string;
}

export interface PlanAdaptationBriefLabels {
  days: (count: number) => string;
  minutes: (count: number) => string;
  subjects: (names: string) => string;
}

export interface PlanAdaptationKnownWeek {
  pendingCount: number;
  subjects: readonly string[];
}

interface PendingWeekTask {
  status: string;
  subject: string | null;
}

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function subjectKey(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR");
}

/** Structured lines stay. Free text is clipped so the note fits the 500-character API cap. */
export function composePlanAdaptationNote(
  answers: PlanAdaptationBriefAnswers,
  labels: PlanAdaptationBriefLabels,
): string {
  const parts: string[] = [];
  if (answers.days != null) parts.push(clean(labels.days(answers.days)));
  if (answers.minutes != null) parts.push(clean(labels.minutes(answers.minutes)));
  const subjects: string[] = [];
  const seen = new Set<string>();
  for (const raw of answers.subjects) {
    const name = clean(raw);
    const key = subjectKey(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    subjects.push(name);
    if (subjects.length >= PLAN_ADAPTATION_SUBJECT_CAP) break;
  }
  if (subjects.length > 0) {
    parts.push(clean(labels.subjects(subjects.join(", "))));
  }
  const structured = parts.filter(Boolean).join(" ");
  const free = clean(answers.note);
  if (!structured && !free) return "";
  if (!free) return structured.slice(0, PLAN_ADAPTATION_NOTE_MAX);
  if (!structured) return free.slice(0, PLAN_ADAPTATION_NOTE_MAX);
  const room = PLAN_ADAPTATION_NOTE_MAX - structured.length - 1;
  if (room <= 0) return structured.slice(0, PLAN_ADAPTATION_NOTE_MAX);
  const clipped = free.length <= room ? free : free.slice(0, room).trimEnd();
  return clipped ? `${structured} ${clipped}` : structured;
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
    .filter((name) => name && knownKeys.has(subjectKey(name)))
    .slice(0, PLAN_ADAPTATION_SUBJECT_CAP);
}

export function isMinuteChoice(
  value: number | null,
): value is (typeof PLAN_ADAPTATION_MINUTE_CHOICES)[number] {
  return (
    value != null &&
    (PLAN_ADAPTATION_MINUTE_CHOICES as readonly number[]).includes(value)
  );
}

export function formatKnownBrief(parts: {
  exam: string | null;
  goal: string | null;
  pending: string | null;
}): string | null {
  const line = [parts.exam, parts.goal, parts.pending].filter(Boolean).join(" · ");
  return line || null;
}
