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

/* ------------------------------- streak rules -------------------------------- */

/** Freeze tokens granted per calendar month (anti-shaming bridge for a single missed day). */
export const FREEZE_TOKENS_PER_MONTH = 2;

/**
 * How far back the read-time streak derivation walks `daily_activity`. Bounds the work
 * and is well over a year so a long active streak is still fully counted.
 */
export const STREAK_LOOKBACK_DAYS = 400;
