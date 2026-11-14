import type {
  CoachPlanAdaptationBriefDto,
  CoachPlanAdaptationChangeDto,
  CoachUsedEvidenceDto,
} from "@mentor/types";
import {
  coachPlanAdaptationSchema,
  PLAN_ADAPTATION_MINUTES,
  PLAN_ADAPTATION_MINUTES_MAX,
  PLAN_ADAPTATION_MINUTES_MIN,
  type ApplyPlanAdaptationInput,
  type CoachPlanAdaptationInput,
} from "@mentor/validation";

/* "Puhu'yla planla" rules shared by the web and the phone (moved from the web plan, mobile stop C). */

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

/** The window as of now. "Today" is the student's own day; the API maps weekdays onto its window. */
export function planWindowToday(): PlanWindowDay[] {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)?.value);
  return planWindowDays(new Date(part("year"), part("month") - 1, part("day"), 12));
}

export function formatKnownBrief(parts: {
  exam: string | null;
  goal: string | null;
  pending: string | null;
}): string | null {
  const line = [parts.exam, parts.goal, parts.pending].filter(Boolean).join(" · ");
  return line || null;
}

/**
 * "Şehrin üstünde" (DESIGN.md §9.1): while the coach's preview is on its way, what it read drops
 * in as paper notes, one per line. The timings live here; the stage only draws them.
 */
export const STAGE_TIMING = {
  /** One note, before the next drops. The scene's only clock. */
  lineMs: 3_600,
  /** From here on the scene says the coach is still at it. */
  slowAfterMs: 12_000,
  /** The ready title shows and the pile leaves before the preview opens. */
  arrivalMs: 1_200,
} as const;

/** The API sends at most this many too (`PLAN_EVIDENCE_MAX`). */
export const STAGE_MAX_NOTES = 6;

/** The notes are the coach's own evidence, in its order; no brief means no notes. */
export function stageNotes(
  brief: CoachPlanAdaptationBriefDto | null,
): CoachUsedEvidenceDto[] {
  return brief ? brief.evidence.slice(0, STAGE_MAX_NOTES) : [];
}

/** Which note is on top: a new one every line, round again after the last. */
export function stageNoteIndex(elapsedMs: number, count: number): number {
  return count === 0 ? 0 : Math.floor(elapsedMs / STAGE_TIMING.lineMs) % count;
}

/**
 * Blank sheets under the top note: one per note already read, never more than two, and never more
 * than the other notes there are.
 */
export function stagePileDepth(elapsedMs: number, count: number): 0 | 1 | 2 {
  const read = Math.floor(elapsedMs / STAGE_TIMING.lineMs);
  return Math.max(0, Math.min(2, read, count - 1)) as 0 | 1 | 2;
}

export interface PlanAdaptationRow {
  key: string;
  date: string;
  change: CoachPlanAdaptationChangeDto;
}

export function flattenPlanAdaptationChanges(
  changes: readonly CoachPlanAdaptationChangeDto[],
): PlanAdaptationRow[] {
  return changes.map((change, index) => ({
    key:
      change.kind === "MOVE"
        ? `MOVE:${change.taskId}`
        : `ADD:${change.taskDate}:${index}`,
    date: change.kind === "MOVE" ? change.toDate : change.taskDate,
    change,
  }));
}

export function selectedPlanAdaptationChanges(
  rows: readonly PlanAdaptationRow[],
  selected: ReadonlySet<string>,
): ApplyPlanAdaptationInput["changes"] {
  return rows.filter((row) => selected.has(row.key)).map((row) => row.change);
}

export function parsePlanAdaptationQuery(input: {
  coach: string | null;
  source: string | null;
  sessionId: string | null;
}): CoachPlanAdaptationInput | null {
  if (input.coach !== "adapt") return null;
  const candidate =
    input.source === "mood"
      ? { source: "MOOD" as const }
      : input.source === "session"
        ? { source: "SESSION" as const, sessionId: input.sessionId ?? "" }
        : input.source === "plan"
          ? { source: "PLAN" as const }
          : null;
  if (!candidate) return null;
  const parsed = coachPlanAdaptationSchema.safeParse(candidate);
  return parsed.success ? (candidate as CoachPlanAdaptationInput) : null;
}
