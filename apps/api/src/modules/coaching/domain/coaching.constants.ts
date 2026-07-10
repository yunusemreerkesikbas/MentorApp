/**
 * Coaching domain constants (invariants / business config — not magic numbers, §engineering-principles).
 * Tunables that an operator might change later belong in a config registry; these are domain invariants.
 */
import type { SessionPresetDto } from "@mentor/types";

export const PlanTaskStatus = {
  PENDING: "PENDING",
  DONE: "DONE",
} as const;
export type PlanTaskStatus = (typeof PlanTaskStatus)[keyof typeof PlanTaskStatus];

export const StudySessionStatus = {
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  ABANDONED: "ABANDONED",
} as const;
export type StudySessionStatus = (typeof StudySessionStatus)[keyof typeof StudySessionStatus];

export const SessionPreset = {
  POMODORO_25_5: "25_5",
  DEEP_50_10: "50_10",
  CUSTOM: "custom",
} as const;
export type SessionPreset = (typeof SessionPreset)[keyof typeof SessionPreset];

/**
 * Pomodoro presets surfaced to the client (label is Turkish, product default locale).
 * `id` matches the persisted `study_sessions.preset` value.
 */
export const SESSION_PRESETS: readonly SessionPresetDto[] = [
  { id: "25_5", label: "25 / 5 dk", focusMinutes: 25, breakMinutes: 5 },
  { id: "50_10", label: "50 / 10 dk", focusMinutes: 50, breakMinutes: 10 },
] as const;

/** Whether a finalized session meets the platform min-focus threshold (streak/XP/quests). */
export function qualifiesAsFocusSession(
  actualFocusSeconds: number,
  minFocusSeconds: number,
): boolean {
  return actualFocusSeconds >= minFocusSeconds;
}

/* ------------------------------- streak rules -------------------------------- */

/** Freeze tokens granted per calendar month (anti-shaming bridge for a single missed day). */
export const FREEZE_TOKENS_PER_MONTH = 2;

/**
 * How far back the read-time streak derivation walks `daily_activity`. Bounds the work
 * and is well over a year so a long active streak is still fully counted.
 */
export const STREAK_LOOKBACK_DAYS = 400;

/* -------------------------- recent-session summary --------------------------- */

/** Rolling window (days) for the "son seanslar" summary fed to the AI coach context. */
export const RECENT_SESSION_WINDOW_DAYS = 7;
/** Max distinct subjects surfaced in the recent-session summary (keeps the prompt bounded). */
export const RECENT_SUBJECTS_MAX = 4;

/**
 * PII-free aggregate of a user's recent study behavior, consumed by the AI coach context
 * (§4 #6 — counts + own subject names + own note only; no behavioral raw data / no PII).
 * `null`-returning services use it as an optional grounding signal.
 */
export interface RecentSessionSummary {
  /** Finalized sessions within {@link RECENT_SESSION_WINDOW_DAYS}. */
  count7d: number;
  /** Total focused minutes within the window (rounded). */
  focusMinutes7d: number;
  /** Distinct recent subjects (most-recent first, capped at {@link RECENT_SUBJECTS_MAX}). */
  subjects: string[];
  /** Most recent non-empty post-session struggle note (null if none). */
  lastStruggleNote: string | null;
}

/* ----------------------------- today-plan summary ---------------------------- */

/** Max pending task titles surfaced in the today-plan summary (keeps the prompt bounded). */
export const TODAY_PLAN_PENDING_MAX = 5;

/**
 * PII-free aggregate of today's plan tasks, consumed by the AI coach context
 * (§4 #6 — counts + the user's own task titles only; no PII).
 */
export interface TodayPlanSummary {
  total: number;
  done: number;
  /** Pending task titles (capped at {@link TODAY_PLAN_PENDING_MAX}). */
  pendingTitles: string[];
}
