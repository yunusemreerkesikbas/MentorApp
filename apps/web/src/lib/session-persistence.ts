/**
 * Active study-session persistence (localStorage) so a running Pomodoro
 * survives page reloads and in-app navigation.
 *
 * Pure module (no React) — resume math is unit-tested from
 * apps/api/src/session-persistence.spec.ts (repo convention).
 */

const STORAGE_KEY = "mentor.session.active";
/** Records older than this are stale garbage, not a resumable session. */
const MAX_RECORD_AGE_MS = 24 * 60 * 60 * 1000;

export type PersistedPreset = "25_5" | "50_10" | "custom";

export interface ActiveSessionRecord {
  sessionId: string;
  phase: "focus" | "break";
  /** Wall-clock epoch ms when the current phase ends (stale while paused). */
  phaseEndsAt: number;
  isPaused: boolean;
  /** Epoch ms of the pause start; the timer is frozen from this instant. */
  pausedAt: number | null;
  focusMinutes: number;
  breakMinutes: number;
  preset: PersistedPreset;
  subject: string | null;
  planTaskId: string | null;
  planTaskTitle: string | null;
  /** Focus seconds observed so far (wall-clock derived, pauses excluded). */
  focusElapsed: number;
  /** Epoch ms of the last write — the last observed heartbeat. */
  savedAt: number;
}

export type ResumeResolution =
  | { kind: "resume-focus"; secondsLeft: number }
  | { kind: "resume-break"; secondsLeft: number }
  /** Focus expired while the tab was away — finalize with the credited seconds. */
  | { kind: "finalize-expired"; creditSeconds: number }
  /** Break expired while away — the session was already finalized at focus end. */
  | { kind: "done" }
  | { kind: "discard" };

function isValidRecord(value: unknown): value is ActiveSessionRecord {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Partial<ActiveSessionRecord>;
  return (
    typeof r.sessionId === "string" &&
    r.sessionId.length > 0 &&
    (r.phase === "focus" || r.phase === "break") &&
    Number.isFinite(r.phaseEndsAt) &&
    typeof r.isPaused === "boolean" &&
    (r.pausedAt === null || Number.isFinite(r.pausedAt)) &&
    Number.isFinite(r.focusMinutes) &&
    Number.isFinite(r.breakMinutes) &&
    (r.preset === "25_5" || r.preset === "50_10" || r.preset === "custom") &&
    Number.isFinite(r.focusElapsed) &&
    Number.isFinite(r.savedAt)
  );
}

export function readActiveSession(): ActiveSessionRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidRecord(parsed)) return null;
    return {
      ...parsed,
      subject: parsed.subject ?? null,
      planTaskId: parsed.planTaskId ?? null,
      planTaskTitle: parsed.planTaskTitle ?? null,
    };
  } catch {
    return null;
  }
}

export function writeActiveSession(record: ActiveSessionRecord): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage unavailable — ignore
  }
}

export function clearActiveSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Decide what a freshly mounted timer should do with a persisted record.
 * While paused the timer is frozen: remaining time is measured against
 * `pausedAt`, not `now`, so a paused session stays resumable until the
 * record ages out (MAX_RECORD_AGE_MS).
 */
export function resolveResume(
  record: ActiveSessionRecord,
  now: number,
): ResumeResolution {
  if (now - record.savedAt > MAX_RECORD_AGE_MS) return { kind: "discard" };

  const frozen = record.isPaused && record.pausedAt !== null;
  const remainingMs = record.phaseEndsAt - (frozen ? record.pausedAt! : now);
  const secondsLeft = Math.max(0, Math.round(remainingMs / 1000));

  if (record.phase === "break") {
    return secondsLeft > 0 ? { kind: "resume-break", secondsLeft } : { kind: "done" };
  }

  if (secondsLeft > 0) return { kind: "resume-focus", secondsLeft };

  // Focus expired while away: credit the last observed elapsed advanced up to
  // the wall-clock focus end — time after expiry earns nothing.
  const plannedSeconds = record.focusMinutes * 60;
  const advanceSeconds = frozen
    ? 0
    : Math.max(
        0,
        Math.round((Math.min(now, record.phaseEndsAt) - record.savedAt) / 1000),
      );
  const creditSeconds = Math.min(
    plannedSeconds,
    Math.max(0, Math.round(record.focusElapsed) + advanceSeconds),
  );
  return { kind: "finalize-expired", creditSeconds };
}
