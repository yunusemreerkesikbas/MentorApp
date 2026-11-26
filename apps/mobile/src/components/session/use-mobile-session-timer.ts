import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  parseInitialBreakMinutes,
  parseInitialMinutes,
  parseInitialPreset,
} from "@mentor/core";
import {
  SESSION_ACTUAL_SECONDS_MAX,
  SESSION_FOCUS_MINUTES_MAX,
  SESSION_FOCUS_MINUTES_MIN,
  type SessionPresetId,
  type StudySessionDto,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import {
  finalizeStudySession,
  recordSessionFeedback,
  startStudySession,
} from "../../lib/coaching-api.js";
import { haptics } from "../../lib/haptics.js";
import { clearActiveSession, saveActiveSession, type SessionResume } from "../../lib/session-store.js";

export type MobileSessionPhase = "idle" | "focus" | "break" | "done";

export interface UseMobileSessionTimerOptions {
  presetParam?: string | null;
  minutesParam?: string | null;
  subject?: string | null;
  planTaskId?: string | null;
  roomId?: string | null;
  planTaskTitle?: string | null;
  /** A session kept from an earlier visit to the screen (`loadSessionResume`). */
  resume?: SessionResume | null;
  onSessionCompleted?: (session: StudySessionDto) => void;
}

const CUSTOM_BREAK_MINUTES = 5;

export function useMobileSessionTimer(options: UseMobileSessionTimerOptions) {
  const {
    presetParam,
    minutesParam,
    subject = null,
    planTaskId = null,
    roomId = null,
    planTaskTitle = null,
    resume = null,
    onSessionCompleted,
  } = options;
  // Read once: the first render opens straight into the kept session.
  const [kept] = useState(() => resume);
  const keptRecord = kept?.record;
  const r = kept?.resolution;
  const keptRun = r?.kind === "resume-focus" || r?.kind === "resume-break" || r?.kind === "resume-stopwatch" ? r : null;

  const [preset, setPreset] = useState<SessionPresetId>(() =>
    keptRecord?.preset ?? parseInitialPreset(presetParam, minutesParam),
  );
  const [focusMinutes, setFocusMinutesState] = useState<number>(() =>
    keptRecord?.focusMinutes ?? parseInitialMinutes(presetParam, minutesParam),
  );
  const [breakMinutes, setBreakMinutesState] = useState<number>(() =>
    keptRecord?.breakMinutes ?? parseInitialBreakMinutes(presetParam, minutesParam),
  );
  const [phase, setPhase] = useState<MobileSessionPhase>(
    keptRun ? (keptRun.kind === "resume-break" ? "break" : "focus") : "idle",
  );
  const [secondsLeft, setSecondsLeft] = useState<number>(
    keptRun && keptRun.kind !== "resume-stopwatch" ? keptRun.secondsLeft : 0,
  );
  const keptElapsed = keptRun?.kind === "resume-stopwatch"
    ? keptRun.elapsedSeconds
    : keptRun?.kind === "resume-focus" && keptRecord ? keptRecord.focusMinutes * 60 - keptRun.secondsLeft : 0;
  const [focusElapsed, setFocusElapsed] = useState<number>(keptElapsed);
  const [isPaused, setIsPaused] = useState<boolean>(Boolean(keptRun && keptRecord?.isPaused));
  // Busy while a session that ran out off-screen is being closed, so `start` cannot race it.
  const [busy, setBusy] = useState<boolean>(kept?.resolution.kind === "finalize-expired");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [session, setSession] = useState<StudySessionDto | null>(keptRecord?.session ?? null);

  // A kept countdown keeps its absolute end (frozen at `pausedAt` while paused, which is what
  // `togglePause` shifts on resume); a kept stopwatch restarts from its elapsed seconds.
  const keptBase = keptRecord?.isPaused && keptRecord.pausedAt !== null ? keptRecord.pausedAt : Date.now();
  const phaseEndsAtRef = useRef<number>(keptRun ? keptRecord!.phaseEndsAt : 0);
  const stopwatchStartedAtRef = useRef<number>(keptRun ? keptBase - keptElapsed * 1000 : 0);
  const pausedAtRef = useRef<number>(keptRun && keptRecord?.isPaused ? keptBase : 0);
  const focusElapsedRef = useRef<number>(keptElapsed);
  const advancingRef = useRef<boolean>(false);
  const sessionRef = useRef<StudySessionDto | null>(keptRecord?.session ?? null);

  const isStopwatch = preset === "stopwatch";

  const selectPreset = useCallback((nextPreset: SessionPresetId) => {
    haptics.selection();
    setPreset(nextPreset);
    setErrorMessage(null);
    if (nextPreset === "25_5") {
      setFocusMinutesState(25);
      setBreakMinutesState(5);
    } else if (nextPreset === "50_10") {
      setFocusMinutesState(50);
      setBreakMinutesState(10);
    } else if (nextPreset === "stopwatch") {
      setBreakMinutesState(0);
    } else {
      setBreakMinutesState(CUSTOM_BREAK_MINUTES);
    }
  }, []);

  const setCustomMinutes = useCallback((minutes: number) => {
    const clamped = Math.max(
      SESSION_FOCUS_MINUTES_MIN,
      Math.min(SESSION_FOCUS_MINUTES_MAX, Math.round(minutes)),
    );
    setPreset("custom");
    setFocusMinutesState(clamped);
    setBreakMinutesState(CUSTOM_BREAK_MINUTES);
  }, []);

  const start = useCallback(async () => {
    if (busy) return false;
    setBusy(true);
    setErrorMessage(null);
    try {
      const created = await startStudySession({
        preset,
        focusMinutes: preset === "custom" ? focusMinutes : undefined,
        subject: subject?.trim() || null,
        planTaskId: planTaskId || undefined,
        ...(roomId?.trim() ? { roomId: roomId.trim() } : {}),
      });
      setSession(created);
      sessionRef.current = created;
      focusElapsedRef.current = 0;
      setFocusElapsed(0);
      setIsPaused(false);
      advancingRef.current = false;

      const now = Date.now();
      stopwatchStartedAtRef.current = now;
      const totalSeconds = focusMinutes * 60;
      phaseEndsAtRef.current = now + totalSeconds * 1000;
      setSecondsLeft(totalSeconds);
      setPhase("focus");
      haptics.selection();
      return true;
    } catch (err) {
      setErrorMessage(
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : "Seans başlatılamadı.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, focusMinutes, planTaskId, preset, subject]);

  const togglePause = useCallback(() => {
    const now = Date.now();
    haptics.selection();
    if (isPaused) {
      const pausedDuration = now - pausedAtRef.current;
      phaseEndsAtRef.current += pausedDuration;
      stopwatchStartedAtRef.current += pausedDuration;
      setIsPaused(false);
    } else {
      pausedAtRef.current = now;
      if (isStopwatch) {
        const elapsed = Math.max(
          0,
          Math.floor((now - stopwatchStartedAtRef.current) / 1000),
        );
        focusElapsedRef.current = elapsed;
        setFocusElapsed(elapsed);
      }
      setIsPaused(true);
    }
  }, [isPaused, isStopwatch]);

  const finalize = useCallback(
    async (status: "COMPLETED" | "ABANDONED", overrideSeconds?: number) => {
      const active = sessionRef.current;
      if (!active || busy) return;
      setBusy(true);
      setErrorMessage(null);
      try {
        const rawSeconds =
          overrideSeconds ??
          (isStopwatch
            ? focusElapsedRef.current
            : Math.max(0, focusMinutes * 60 - secondsLeft));
        const actualFocusSeconds = Math.min(
          SESSION_ACTUAL_SECONDS_MAX,
          Math.max(0, Math.round(rawSeconds)),
        );
        const updated = await finalizeStudySession(active.id, {
          status,
          actualFocusSeconds,
        });
        setSession(updated);
        sessionRef.current = updated;
        focusElapsedRef.current = updated.actualFocusSeconds;
        setFocusElapsed(updated.actualFocusSeconds);

        if (status === "ABANDONED") {
          setPhase("idle");
        } else {
          haptics.success();
          onSessionCompleted?.(updated);
          if (!isStopwatch && breakMinutes > 0 && phase === "focus") {
            const breakSec = breakMinutes * 60;
            phaseEndsAtRef.current = Date.now() + breakSec * 1000;
            setSecondsLeft(breakSec);
            setIsPaused(false);
            advancingRef.current = false;
            setPhase("break");
          } else {
            setPhase("done");
          }
        }
      } catch (err) {
        setErrorMessage(
          err instanceof ApiClientError || err instanceof Error
            ? err.message
            : "Seans kaydedilemedi.",
        );
      } finally {
        setBusy(false);
      }
    },
    [breakMinutes, busy, focusMinutes, isStopwatch, onSessionCompleted, phase, secondsLeft],
  );

  // Timestamp-driven tick + AppState foreground sync
  const syncClock = useCallback(() => {
    if ((phase !== "focus" && phase !== "break") || isPaused) return;
    const now = Date.now();

    if (phase === "focus" && isStopwatch) {
      const elapsed = Math.min(
        SESSION_ACTUAL_SECONDS_MAX,
        Math.max(0, Math.floor((now - stopwatchStartedAtRef.current) / 1000)),
      );
      focusElapsedRef.current = elapsed;
      setFocusElapsed(elapsed);
      return;
    }

    const remaining = Math.max(
      0,
      Math.ceil((phaseEndsAtRef.current - now) / 1000),
    );
    setSecondsLeft(remaining);
    if (phase === "focus") {
      const elapsed = Math.max(0, focusMinutes * 60 - remaining);
      focusElapsedRef.current = elapsed;
      setFocusElapsed(elapsed);
    }

    if (remaining <= 0 && !advancingRef.current) {
      advancingRef.current = true;
      if (phase === "focus") {
        void finalize("COMPLETED", focusMinutes * 60);
      } else {
        setPhase("done");
      }
    }
  }, [finalize, focusMinutes, isPaused, isStopwatch, phase]);

  useEffect(() => {
    if ((phase !== "focus" && phase !== "break") || isPaused) return;
    const interval = setInterval(syncClock, 500);
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") syncClock();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [isPaused, phase, syncClock]);

  // Keep the running session across leaving the screen (the web's `mentor.session.active`). Written
  // on every phase or pause change; between those the clock math needs nothing new.
  useEffect(() => {
    const active = sessionRef.current;
    if ((phase === "focus" || phase === "break") && active) {
      saveActiveSession({
        sessionId: active.id, phase, phaseEndsAt: phaseEndsAtRef.current, isPaused,
        pausedAt: isPaused ? pausedAtRef.current : null, focusMinutes, breakMinutes, preset,
        subject: subject?.trim() || null, planTaskId, planTaskTitle, roomId, session: active,
        focusElapsed: focusElapsedRef.current, savedAt: Date.now(),
      });
    } else if (phase === "done" || (phase === "idle" && kept?.resolution.kind !== "finalize-expired")) {
      clearActiveSession();
    }
    // Only transitions write; the rest are read as they stand at that moment.
  }, [phase, isPaused, session]);

  // Focus ran out while the screen was closed: credit it up to the focus end and show the result.
  useEffect(() => {
    if (kept?.resolution.kind !== "finalize-expired") return;
    const credit = kept.resolution.creditSeconds;
    void finalizeStudySession(kept.record.sessionId, { status: "COMPLETED", actualFocusSeconds: credit })
      .then((updated) => {
        // The record goes only once the server has the session; a failure keeps it for the next open.
        clearActiveSession();
        setSession(updated);
        sessionRef.current = updated;
        focusElapsedRef.current = updated.actualFocusSeconds;
        setFocusElapsed(updated.actualFocusSeconds);
        setPhase("done");
        onSessionCompleted?.(updated);
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : "Seans kaydedilemedi.");
      })
      .finally(() => setBusy(false));
    // Once, on mount.
  }, []);

  const skipBreak = useCallback(() => {
    haptics.selection();
    setPhase("done");
  }, []);

  const reset = useCallback(() => {
    haptics.selection();
    setPhase("idle");
    setSession(null);
    sessionRef.current = null;
    setSecondsLeft(0);
    setFocusElapsed(0);
    setIsPaused(false);
    setErrorMessage(null);
  }, []);

  const submitFeedback = useCallback(
    async (mood: number, struggleNote?: string) => {
      if (!sessionRef.current) return;
      await recordSessionFeedback(sessionRef.current.id, {
        mood,
        struggleNote: struggleNote?.trim() || undefined,
      });
      haptics.success();
    },
    [],
  );

  return {
    preset,
    focusMinutes,
    breakMinutes,
    isStopwatch,
    phase,
    secondsLeft,
    focusElapsed,
    isPaused,
    busy,
    errorMessage,
    session,
    selectPreset,
    setCustomMinutes,
    start,
    togglePause,
    finalize,
    skipBreak,
    reset,
    submitFeedback,
  };
}
