import type { StudyRoomTheme, StudySessionDto } from "@mentor/types";

/**
 * Pure pieces of the web's `/seans` screen, kept free of React Native so they run under
 * `node --test`. Sources: `@mentor/ui` circular-timer-ring.utils, web `lib/ambient-tracks`,
 * `lib/completion-stars`, `lib/session-share`, `lib/history-date-range`, `session-history`.
 */

// ── Timer dial ───────────────────────────────────────────────────────────────────────────────

export const TIMER_TICK_COUNT = 60;

export function timerTickLine(index: number, cx: number, cy: number, radius: number) {
  const major = index % 5 === 0;
  const angle = ((index / TIMER_TICK_COUNT) * 360 - 90) * (Math.PI / 180);
  const outer = radius - 2;
  const inner = radius - (major ? 12 : 7);
  return {
    x1: cx + inner * Math.cos(angle),
    y1: cy + inner * Math.sin(angle),
    x2: cx + outer * Math.cos(angle),
    y2: cy + outer * Math.sin(angle),
    major,
  };
}

/** Degrees clockwise from 12 o'clock (0–360) for a point relative to the dial's centre. */
export function angleFromPoint(dx: number, dy: number): number {
  const angle = Math.atan2(dx, -dy) * (180 / Math.PI);
  return angle < 0 ? angle + 360 : angle;
}

export function clampMinutes(minutes: number, min: number, max: number, step: number): number {
  return Math.min(max, Math.max(min, Math.round(minutes / step) * step));
}

export function minutesFromAngle(angle: number, min: number, max: number, step: number): number {
  return clampMinutes(min + (angle / 360) * (max - min), min, max, step);
}

export function angleFromMinutes(minutes: number, min: number, max: number): number {
  return ((minutes - min) / (max - min)) * 360;
}

// ── Scene and room sound ─────────────────────────────────────────────────────────────────────

export const ROOM_THEMES: readonly StudyRoomTheme[] = ["LIBRARY", "CAFE", "HOME"];

export interface SessionScene {
  theme: StudyRoomTheme;
  /** "Sade görünüm": no room photo behind the timer. */
  plain: boolean;
}

export const DEFAULT_SESSION_SCENE: SessionScene = { theme: "LIBRARY", plain: false };

export function readSessionScene(raw: string | null): SessionScene {
  try {
    const parsed = JSON.parse(raw ?? "") as Partial<SessionScene>;
    return {
      theme: ROOM_THEMES.includes(parsed.theme as StudyRoomTheme) ? (parsed.theme as StudyRoomTheme) : "LIBRARY",
      plain: parsed.plain === true,
    };
  } catch {
    return DEFAULT_SESSION_SCENE;
  }
}

export const AMBIENT_TRACK_IDS = ["scene", "library", "cafe", "home", "off"] as const;
export type AmbientTrackId = (typeof AMBIENT_TRACK_IDS)[number];

export interface AmbientPreference {
  trackId: AmbientTrackId;
  muted: boolean;
}

export function readAmbientPreference(raw: string | null): AmbientPreference {
  try {
    const parsed = JSON.parse(raw ?? "") as Partial<AmbientPreference>;
    const trackId = AMBIENT_TRACK_IDS.includes(parsed.trackId as AmbientTrackId)
      ? (parsed.trackId as AmbientTrackId)
      : "off";
    return { trackId, muted: trackId !== "off" && parsed.muted === true };
  } catch {
    return { trackId: "off", muted: false };
  }
}

const PINNED_THEME: Partial<Record<AmbientTrackId, StudyRoomTheme>> = {
  library: "LIBRARY",
  cafe: "CAFE",
  home: "HOME",
};

/** Whose room plays: "Sahneye uygun" follows the scene on screen, a named room is pinned. */
export function ambientTheme(trackId: AmbientTrackId, sceneTheme: StudyRoomTheme): StudyRoomTheme | null {
  if (trackId === "off") return null;
  return PINNED_THEME[trackId] ?? sceneTheme;
}

/** The room sounds only while the timer runs: focus or break, not paused, not muted. */
export function shouldPlayAmbient(
  phase: "idle" | "focus" | "break" | "done",
  isPaused: boolean,
  preference: AmbientPreference,
): boolean {
  return preference.trackId !== "off" && !preference.muted && (phase === "focus" || phase === "break") && !isPaused;
}

// ── Done state ───────────────────────────────────────────────────────────────────────────────

export const COMPLETION_STAR_TOTAL = 3;

/** 1–3 stars in halves: how much of the planned focus was done. A too-short try still gets one. */
export function sessionStarFill(input: {
  elapsedSec: number;
  plannedSec: number;
  countsAsFocusSession: boolean;
  abandoned?: boolean;
}): number {
  if (!input.countsAsFocusSession && !input.abandoned) return 1;
  const planned = input.plannedSec > 0 ? input.plannedSec : Math.max(input.elapsedSec, 1);
  const ratio = Math.min(1, Math.max(0, input.elapsedSec / planned));
  return Math.min(COMPLETION_STAR_TOTAL, Math.max(1, Math.round(ratio * COMPLETION_STAR_TOTAL * 2) / 2));
}

/** Whole minutes to share, or null when there is nothing to share (under a minute, too short). */
export function shareableMinutes(focusElapsedSeconds: number, countsAsFocusSession: boolean): number | null {
  const minutes = Math.floor(focusElapsedSeconds / 60);
  return minutes > 0 && countsAsFocusSession ? minutes : null;
}

/** "Bugünün 2. seansı": the session's place among today's counted ones. */
export function shareSessionOrdinal(
  today: Pick<StudySessionDto, "id" | "status" | "startedAt" | "countsAsFocusSession">[],
  sessionId: string | null,
): number {
  const counted = today.filter((s) => s.status === "COMPLETED" && s.countsAsFocusSession !== false);
  const self = counted.find((s) => s.id === sessionId);
  if (!self) return counted.length + 1;
  return counted.filter((s) => s.startedAt <= self.startedAt).length;
}

// ── History ──────────────────────────────────────────────────────────────────────────────────

export type HistoryDatePreset = "all" | "today" | "7d" | "30d";
export const HISTORY_DATE_PRESETS: readonly HistoryDatePreset[] = ["all", "today", "7d", "30d"];

/** Inclusive UTC yyyy-mm-dd bounds for `GET /v1/study-sessions`, as the web sends them. */
export function historyDateRange(preset: HistoryDatePreset, now = new Date()): { from?: string; to?: string } {
  if (preset === "all") return {};
  const to = now.toISOString().slice(0, 10);
  if (preset === "today") return { from: to, to };
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - (preset === "7d" ? 6 : 29));
  return { from: from.toISOString().slice(0, 10), to };
}

export function distinctSubjects(items: Pick<StudySessionDto, "subject">[]): string[] {
  const subjects: string[] = [];
  for (const item of items) {
    const subject = item.subject?.trim();
    if (subject && !subjects.includes(subject)) subjects.push(subject);
  }
  return subjects;
}

/** Consecutive sessions on the same local day, newest first as the API sends them. */
export function groupSessionsByDay<T extends Pick<StudySessionDto, "startedAt">>(items: T[]): { key: string; items: T[] }[] {
  const groups: { key: string; items: T[] }[] = [];
  for (const item of items) {
    const key = new Date(item.startedAt).toDateString();
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  return groups;
}

/**
 * A running session kept across leaving the session screen: the web's `session-persistence.ts`
 * (localStorage `mentor.session.active`), same record and same resume rules.
 */
export interface ActiveSessionRecord {
  sessionId: string;
  phase: "focus" | "break";
  /** Wall-clock epoch ms when the current phase ends (stale while paused). */
  phaseEndsAt: number;
  isPaused: boolean;
  pausedAt: number | null;
  focusMinutes: number;
  breakMinutes: number;
  preset: "25_5" | "50_10" | "custom" | "stopwatch";
  subject: string | null;
  planTaskId: string | null;
  planTaskTitle: string | null;
  roomId: string | null;
  /** Mobile only: the started session itself, so a reopened screen can finish and rate it. */
  session: StudySessionDto;
  /** Focus seconds observed so far (pauses excluded). */
  focusElapsed: number;
  /** Epoch ms of the last write. */
  savedAt: number;
  /** Mobile only: the signed-in account that ran it; a record of anyone else is never restored. */
  userId?: string;
}

export type ResumeResolution =
  | { kind: "resume-focus"; secondsLeft: number }
  | { kind: "resume-stopwatch"; elapsedSeconds: number }
  | { kind: "resume-break"; secondsLeft: number }
  | { kind: "finalize-expired"; creditSeconds: number }
  | { kind: "done" }
  | { kind: "discard" };

/**
 * Whether the account signed in now may restore this record. A record of another account, or one
 * written before records carried an owner, never comes back (a failed sign-out delete leaks nothing).
 */
export function isOwnRecord(record: ActiveSessionRecord, owner: string | null): boolean {
  return owner !== null && record.userId === owner;
}

export function readActiveSessionRecord(raw: string | null): ActiveSessionRecord | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Partial<ActiveSessionRecord>;
    const ok = typeof r.sessionId === "string" && r.sessionId.length > 0
      && (r.phase === "focus" || r.phase === "break")
      && Number.isFinite(r.phaseEndsAt) && typeof r.isPaused === "boolean"
      && (r.pausedAt === null || Number.isFinite(r.pausedAt))
      && Number.isFinite(r.focusMinutes) && Number.isFinite(r.breakMinutes)
      && (r.preset === "25_5" || r.preset === "50_10" || r.preset === "custom" || r.preset === "stopwatch")
      && Number.isFinite(r.focusElapsed) && Number.isFinite(r.savedAt)
      && r.session?.id === r.sessionId;
    return ok ? {
      ...(r as ActiveSessionRecord),
      subject: r.subject ?? null, planTaskId: r.planTaskId ?? null, planTaskTitle: r.planTaskTitle ?? null, roomId: r.roomId ?? null,
    } : null;
  } catch {
    return null;
  }
}

/** The web's `resolveResume`: what a freshly opened session screen does with a kept record. */
export function resolveSessionResume(record: ActiveSessionRecord, now: number, maxAgeMs: number): ResumeResolution {
  if (now - record.savedAt > maxAgeMs) return { kind: "discard" };
  if (record.preset === "stopwatch") {
    const advance = record.isPaused ? 0 : Math.max(0, Math.floor((now - record.savedAt) / 1000));
    return { kind: "resume-stopwatch", elapsedSeconds: record.focusElapsed + advance };
  }
  const frozen = record.isPaused && record.pausedAt !== null;
  const secondsLeft = Math.max(0, Math.round((record.phaseEndsAt - (frozen ? record.pausedAt! : now)) / 1000));
  if (record.phase === "break") return secondsLeft > 0 ? { kind: "resume-break", secondsLeft } : { kind: "done" };
  if (secondsLeft > 0) return { kind: "resume-focus", secondsLeft };
  // Focus ran out while away: credit up to the focus end, nothing after it.
  const advance = frozen ? 0 : Math.max(0, Math.round((Math.min(now, record.phaseEndsAt) - record.savedAt) / 1000));
  return { kind: "finalize-expired", creditSeconds: Math.min(record.focusMinutes * 60, Math.max(0, Math.round(record.focusElapsed) + advance)) };
}
