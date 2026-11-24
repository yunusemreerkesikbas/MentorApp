import {
  isMinuteEntry,
  planAccessView,
  seedBriefSubjects,
  todayInIstanbul,
  type PlanAdaptationRow,
  type PlanWindowDay,
} from "@mentor/core";
import type { CoachPlanAdaptationBriefDto, PlanPreviewAccessDto } from "@mentor/types";
import { coachPlanAdaptationSchema, type CoachPlanAdaptationInput } from "@mentor/validation";
import { apiErrorCode } from "./plan-view.ts";

/** The web's Coin flow state (`use-plan-coin-flow.ts`), shared by the sheet, wizard and stage. */
export type PlanInput = Extract<CoachPlanAdaptationInput, { source: "PLAN" }>;

/** How far the wizard's answers got, so the stage can say what it is building. */
export interface StageProgress {
  done: number;
  total: number;
}

export interface PlanCoinQuote {
  requestId: string;
  cost: number;
  input: PlanInput;
  progress: StageProgress | null;
  resume: boolean;
}

/** The choice sheet as it stands. `pending` answers go out as soon as the price is confirmed. */
export interface PlanCoinSheetState {
  armed: boolean;
  error: string | null;
  pending: { input: PlanInput; progress: StageProgress | null } | null;
  /** A generated draft whose Coin was never taken: confirming pays for it and opens it. */
  resume: PlanCoinQuote | null;
}

/** The request id is the caller's (`newRequestId()`), so a retry of one quote reuses it. */
export const newCoinQuote = (
  { input, progress }: NonNullable<PlanCoinSheetState["pending"]>,
  cost: number,
  requestId: string,
): PlanCoinQuote => ({ input, progress, cost, requestId, resume: false });

/**
 * What the wizard's last button sends. The same answers at the same price go out under the last
 * request's id, so a retry after Vazgeç or a lost answer is one request: the server answers a repeat
 * with the draft it is making or has made, and takes no second Coin.
 */
export function wizardCoinQuote(
  last: PlanCoinQuote | null,
  pending: NonNullable<PlanCoinSheetState["pending"]>,
  cost: number,
  requestId: () => string,
): PlanCoinQuote {
  const same = last && !last.resume && last.cost === cost && JSON.stringify(last.input) === JSON.stringify(pending.input);
  return same ? { ...last, progress: pending.progress } : newCoinQuote(pending, cost, requestId());
}

/** A failed Coin request may go again under its id only when the server gave no verdict on it yet. */
export function keepsCoinQuote(error: unknown): boolean {
  const code = apiErrorCode(error);
  return code === null || code === "AI_PLAN_REQUEST_PROCESSING";
}

/** What one tap on "Puhu'yla planla" opens. The phone never sells Premium: purchases are off. */
export function planOpenStep(offer: PlanPreviewAccessDto): "saved" | "wizard" | "sheet" {
  if (offer.mode !== "COIN" && !offer.canGenerate && offer.latestRequestId) return "saved";
  return planAccessView(offer, false).kind === "wizard" ? "wizard" : "sheet";
}

/** The sheet's notice: the server's message, except its Premium line, which the phone never shows. */
export function planNoticeText(offer: PlanPreviewAccessDto, phoneClosed: string): string {
  return offer.reason === "PAYMENT_PREMIUM_REQUIRED" ? phoneClosed : (offer.message ?? "");
}

/**
 * iOS drops a modal presented while another is still closing, so on iOS the next step waits for
 * the closing modal's `onDismiss` (which calls `flush`). Android presents at once.
 */
export function createDismissQueue(platform: string): { queue(run: () => void): void; flush(): void } {
  let waiting: (() => void) | null = null;
  return {
    queue(run) {
      if (platform === "ios") waiting = run;
      else run();
    },
    flush() {
      const run = waiting;
      waiting = null;
      run?.();
    },
  };
}

/** When the next Coin draft arrives, as the sheet says it: Istanbul's clock and calendar day. */
export function nextAvailableParts(iso: string, now: Date): { day: "today" | "tomorrow"; time: string } {
  const at = new Date(iso);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
  return { day: todayInIstanbul(at) === todayInIstanbul(now) ? "today" : "tomorrow", time };
}

/** The student's own wizard answers; null (or undefined for minutes) means the step is untouched. */
export interface BriefOverrides {
  weekdays: number[] | null;
  /** null = skipped, undefined = untouched. */
  minutes: number | null | undefined;
  subjects: string[] | null;
}

/**
 * The wizard's answers as they stand (the web brief's state): the student's own answer always
 * wins; until there is one, the goal, then Puhu's reading of the rhythm, fills the blank.
 */
export function planBriefAnswers({
  brief,
  goalMinutes: goal,
  taxonomyNames,
  knownSubjects,
  overrides,
}: {
  brief: CoachPlanAdaptationBriefDto | null;
  goalMinutes: number | null;
  /** null while the exam taxonomy is still loading. */
  taxonomyNames: readonly string[] | null;
  knownSubjects: readonly string[];
  overrides: BriefOverrides;
}) {
  const suggestion = brief?.suggestion ?? null;
  const rhythmWeekdays = suggestion?.weekdays ?? [];
  const goalMinutes = isMinuteEntry(goal) ? goal : null;
  const suggested = suggestion?.minutesPerDay ?? null;
  const rhythmMinutes = goalMinutes === null && isMinuteEntry(suggested) ? suggested : null;
  const focus = suggestion?.focusSubjects;
  const seeded = taxonomyNames
    ? seedBriefSubjects([...taxonomyNames], focus?.length ? focus : [...knownSubjects])
    : [];
  return {
    weekdays: overrides.weekdays ?? rhythmWeekdays,
    rhythmWeekdays,
    minutes: overrides.minutes !== undefined ? overrides.minutes : (goalMinutes ?? rhythmMinutes),
    goalMinutes,
    rhythmMinutes,
    subjects: overrides.subjects ?? seeded,
  };
}

/** The request the wizard sends (the web brief's `submit`): empty parts left out; null if invalid. */
export function planBriefInput({
  note,
  weekdays,
  minutes,
  subjects,
  window,
}: {
  note: string;
  weekdays: readonly number[];
  minutes: number | null;
  subjects: readonly string[];
  window: readonly PlanWindowDay[];
}): PlanInput | null {
  const trimmed = note.trim();
  const parsed = coachPlanAdaptationSchema.safeParse({
    source: "PLAN",
    ...(trimmed ? { note: trimmed } : {}),
    ...(weekdays.length > 0
      ? { studyWeekdays: window.map((day) => day.weekday).filter((weekday) => weekdays.includes(weekday)) }
      : {}),
    ...(minutes != null ? { minutesPerDay: minutes } : {}),
    ...(subjects.length > 0 ? { focusSubjects: [...subjects] } : {}),
  });
  if (!parsed.success || parsed.data.source !== "PLAN") return null;
  const data = parsed.data;
  return {
    source: "PLAN",
    ...(data.note ? { note: data.note } : {}),
    ...(data.studyWeekdays?.length ? { studyWeekdays: data.studyWeekdays } : {}),
    ...(data.minutesPerDay != null ? { minutesPerDay: data.minutesPerDay } : {}),
    ...(data.focusSubjects?.length ? { focusSubjects: data.focusSubjects } : {}),
  };
}

/** The preview's changes under their day headings: days in order, each day's changes as sent. */
export function groupRowsByDate(rows: readonly PlanAdaptationRow[]): [string, PlanAdaptationRow[]][] {
  const grouped = new Map<string, PlanAdaptationRow[]>();
  for (const row of rows) grouped.set(row.date, [...(grouped.get(row.date) ?? []), row]);
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
}
