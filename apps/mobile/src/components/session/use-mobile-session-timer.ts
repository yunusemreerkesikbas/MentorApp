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

export type MobileSessionPhase = "idle" | "focus" | "break" | "done";

export interface UseMobileSessionTimerOptions {
  presetParam?: string | null;
  minutesParam?: string | null;
  subject?: string | null;
  planTaskId?: string | null;
  onSessionCompleted?: (session: StudySessionDto) => void;
}

const CUSTOM_BREAK_MINUTES = 5;

export function useMobileSessionTimer(options: UseMobileSessionTimerOptions) {
  const {
    presetParam,
    minutesParam,
    subject = null,
    planTaskId = null,
    onSessionCompleted,
  } = options;

  const [preset, setPreset] = useState<SessionPresetId>(() =>
    parseInitialPreset(presetParam, minutesParam),
  );
  const [focusMinutes, setFocusMinutesState] = useState<number>(() =>
    parseInitialMinutes(presetParam, minutesParam),
  );
  const [breakMinutes, setBreakMinutesState] = useState<number>(() =>
    parseInitialBreakMinutes(presetParam, minutesParam),
  );
  const [phase, setPhase] = useState<MobileSessionPhase>("idle");
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [focusElapsed, setFocusElapsed] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [session, setSession] = useState<StudySessionDto | null>(null);

  const phaseEndsAtRef = useRef<number>(0);
  const stopwatchStartedAtRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const focusElapsedRef = useRef<number>(0);
  const advancingRef = useRef<boolean>(false);
  const sessionRef = useRef<StudySessionDto | null>(null);

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
