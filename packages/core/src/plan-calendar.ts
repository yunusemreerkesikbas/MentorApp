/**
 * Platform-neutral Takvim rules shared by web and mobile: subject colour swatches, the
 * role-agnostic calendar item, the Ay legend's month summary and the spotlight stagger.
 *
 * Colours stay abstract here (a theme token + tint percent). Each platform paints them: the web
 * as CSS `color-mix`, mobile by mixing its palette hex. The item builders are generic over the
 * colour so neither platform's colour type leaks into the other.
 */

import type { PlanEventDto, PlanTaskDto } from "@mentor/types";
import { DEFAULT_EVENT_MINUTES, minutesFromHhmm } from "./plan-calendar-layout.js";

export type PlanEventSwatchToken = "progress" | "chip" | "thumbViolet" | "success" | "star" | "secondary";

export interface PlanEventSwatch {
  token: PlanEventSwatchToken;
  /** Background tint over the surface, in percent. */
  tint: number;
}

/**
 * Fixed order: the index is the hash bucket, so reordering re-colours everyone's calendar.
 * Tints are per-swatch so the fills land at a similar lightness.
 */
export const PLAN_EVENT_SWATCHES: readonly PlanEventSwatch[] = [
  { token: "progress", tint: 18 },
  { token: "chip", tint: 24 },
  { token: "thumbViolet", tint: 26 },
  { token: "success", tint: 13 },
  { token: "star", tint: 26 },
];

export const PLAN_EVENT_NEUTRAL_SWATCH: PlanEventSwatch = { token: "secondary", tint: 12 };

/**
 * FNV-1a, stable across sessions and devices. Not the classic `hash * 31 + c` fold: 31 ≡ 1 (mod 5),
 * so that one collapses to `sum(charCodes) % 5` and buckets most KPSS subjects onto one swatch.
 */
function hashSubject(subject: string): number {
  let hash = 2166136261;
  for (let i = 0; i < subject.length; i++) {
    hash ^= subject.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function planEventSwatch(subject: string | null | undefined): PlanEventSwatch {
  const key = subject?.trim();
  if (!key) return PLAN_EVENT_NEUTRAL_SWATCH;
  return PLAN_EVENT_SWATCHES[hashSubject(key) % PLAN_EVENT_SWATCHES.length]!;
}

/**
 * Role-agnostic calendar row. The Takvim surfaces render ONLY this shape, so the same views serve
 * the student plan and the coach plan without either DTO leaking into them.
 * `startTime === null` means ALL-DAY; times are wall-clock "HH:MM" on the item's own date.
 */
export interface PlanCalendarItem<TSource = unknown, TColor = unknown> {
  id: string;
  date: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  color: TColor;
  /** Second line under the title: subject (student) / attendee summary (coach). */
  meta: string | null;
  /** Legend spotlight bucket — student uses the subject. Null opts the item out. */
  groupKey: string | null;
  /** Task vs event (coach). Student items omit this so the chip stays pixel-identical. */
  glyph?: "task" | "event";
  /** Struck through and faded: DONE (student), CANCELLED (coach). */
  muted: boolean;
  /** Preview body. */
  description: string | null;
  /** Preview footer. */
  hint: string | null;
  source: TSource;
}

export interface PlanTaskItemLabels {
  /** Preview footer once the task is complete. */
  done: string;
  /** Preview footer while the task is open. */
  hint: string;
}

export function planTaskCalendarItem<C>(
  task: PlanTaskDto,
  labels: PlanTaskItemLabels,
  colorOf: (subject: string | null) => C,
): PlanCalendarItem<PlanTaskDto, C> {
  const subject = task.subject?.trim() || null;
  return {
    id: task.id,
    date: task.taskDate,
    title: task.title,
    startTime: task.startTime,
    endTime: task.endTime,
    color: colorOf(subject),
    meta: subject,
    groupKey: subject,
    muted: task.status === "DONE",
    description: task.description,
    hint: task.status === "DONE" ? labels.done : labels.hint,
    source: task,
  };
}

export function planTaskCalendarItems<C>(
  tasksByDate: Record<string, PlanTaskDto[]>,
  labels: PlanTaskItemLabels,
  colorOf: (subject: string | null) => C,
): Record<string, PlanCalendarItem<PlanTaskDto, C>[]> {
  const byDate: Record<string, PlanCalendarItem<PlanTaskDto, C>[]> = {};
  for (const [iso, tasks] of Object.entries(tasksByDate)) {
    byDate[iso] = tasks.map((task) => planTaskCalendarItem(task, labels, colorOf));
  }
  return byDate;
}

export interface StudentEventLabels {
  /** Second line of a meeting somebody else (the coach) set up with the student. */
  withCoach: string;
  cancelled: string;
}

/** An event on the student's own calendar. Read-only: a student can open it, not change it. */
export function studentEventCalendarItem<C>(
  event: PlanEventDto,
  viewerId: string,
  labels: StudentEventLabels,
  neutral: C,
): PlanCalendarItem<PlanEventDto, C> {
  const cancelled = event.status === "CANCELLED";
  return {
    id: event.id,
    date: event.eventDate,
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime,
    color: neutral,
    meta: event.organizerUserId === viewerId ? null : labels.withCoach,
    groupKey: null,
    glyph: "event",
    muted: cancelled,
    description: event.description,
    hint: cancelled ? labels.cancelled : null,
    source: event,
  };
}

/** Minimum shape the summary needs — keeps it testable without building full DTOs. */
export interface SummarizableTask {
  title: string;
  subject: string | null;
  status: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes?: number | null;
}

export interface PlanSubjectSummary {
  done: number;
  total: number;
  percent: number;
  /** Distinct days the subject appears on — answers "did I cram it into one day?". */
  dayCount: number;
  /** Explicit study durations first, then legacy calendar durations; null when neither exists. */
  plannedMinutes: number | null;
  /** Nearest task on or after today, within the loaded month; null when none is left. */
  next: { date: string; title: string } | null;
}

/**
 * Month-at-a-glance numbers for one subject, from the range the calendar already has loaded.
 * No request: the legend must answer instantly, and the deeper "am I neglecting this subject"
 * question belongs to Analiz, which has real evidence instead of counts.
 */
export function summarizeSubjectMonth(
  subject: string,
  tasksByDate: Record<string, SummarizableTask[]>,
  monthKey: string,
  today: string,
): PlanSubjectSummary {
  let done = 0;
  let total = 0;
  let dayCount = 0;
  let plannedMinutes = 0;
  let hasTimed = false;
  let next: { date: string; title: string } | null = null;

  for (const iso of Object.keys(tasksByDate).sort()) {
    if (iso.slice(0, 7) !== monthKey) continue;
    const matches = (tasksByDate[iso] ?? []).filter((task) => task.subject?.trim() === subject);
    if (matches.length === 0) continue;

    dayCount += 1;
    for (const task of matches) {
      total += 1;
      if (task.status === "DONE") done += 1;
      if (task.durationMinutes != null) {
        hasTimed = true;
        plannedMinutes += task.durationMinutes;
      } else if (task.startTime) {
        hasTimed = true;
        // Open-ended items are drawn as one hour on the board — count them the same way so the
        // number matches what the user actually sees.
        plannedMinutes += task.endTime
          ? minutesFromHhmm(task.endTime) - minutesFromHhmm(task.startTime)
          : DEFAULT_EVENT_MINUTES;
      }
    }

    // Keys are walked in date order, so the first hit from today onward is the next one up.
    if (next === null && iso >= today) {
      const upcoming = matches.find((task) => task.status !== "DONE") ?? matches[0]!;
      next = { date: iso, title: upcoming.title };
    }
  }

  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    dayCount,
    plannedMinutes: hasTimed ? plannedMinutes : null,
    next,
  };
}

/** "3 sa 30 dk" / "45 dk" — omits the hour part below 60 minutes. */
export function formatPlannedMinutes(minutes: number, labels: { hour: string; minute: string }): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} ${labels.minute}`;
  if (rest === 0) return `${hours} ${labels.hour}`;
  return `${hours} ${labels.hour} ${rest} ${labels.minute}`;
}

/** The legend lights matching chips one after another, capped so a busy month never drags. */
export const SPOTLIGHT_STEP_MS = 25;
export const SPOTLIGHT_MAX_DELAY_MS = 400;

export function spotlightDelay(litIndex: number): number {
  return Math.min(litIndex * SPOTLIGHT_STEP_MS, SPOTLIGHT_MAX_DELAY_MS);
}
