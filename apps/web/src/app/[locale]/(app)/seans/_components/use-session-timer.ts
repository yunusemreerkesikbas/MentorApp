"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { StudySessionDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { finalizeStudySession, startStudySession } from "@/lib/study-sessions";
import { useMentorToast } from "@/lib/mentor-toast";

export type SessionPhase = "idle" | "focus" | "done";

export interface UseSessionTimerOptions {
  initialMinutes?: number;
  initialPreset?: "25_5" | "50_10" | "custom";
}

export interface UseSessionTimerResult {
  phase: SessionPhase;
  focusMinutes: number;
  setFocusMinutes: (minutes: number) => void;
  selectPreset: (presetId: "25_5" | "50_10", minutes: number) => void;
  secondsLeft: number;
  focusElapsed: number;
  isPaused: boolean;
  isTimerComplete: boolean;
  session: StudySessionDto | null;
  busy: boolean;
  startSession: () => Promise<void>;
  togglePause: () => void;
  finalize: (status: "COMPLETED" | "ABANDONED") => Promise<void>;
  reset: () => void;
}

function presetSeconds(minutes: number): number {
  return minutes * 60;
}

/**
 * Client-side focus timer with pause/resume. No forced break phase — user pauses when needed.
 */
export function useSessionTimer(
  options: UseSessionTimerOptions = {},
): UseSessionTimerResult {
  const { initialMinutes = 25, initialPreset = "25_5" } = options;
  const tCommon = useTranslations("common");
  const { error: showErrorToast } = useMentorToast();

  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [focusMinutes, setFocusMinutesState] = useState(initialMinutes);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [focusElapsed, setFocusElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTimerComplete, setIsTimerComplete] = useState(false);
  const [session, setSession] = useState<StudySessionDto | null>(null);
  const [busy, setBusy] = useState(false);

  const phaseEndsAtRef = useRef(0);
  const pausedAtRef = useRef(0);
  const selectedPresetRef = useRef<"25_5" | "50_10" | "custom">(initialPreset);

  const setFocusMinutes = useCallback((minutes: number) => {
    setFocusMinutesState(minutes);
    selectedPresetRef.current = "custom";
  }, []);

  const beginFocus = useCallback((seconds: number) => {
    phaseEndsAtRef.current = Date.now() + seconds * 1000;
    setSecondsLeft(seconds);
    setIsTimerComplete(false);
    setIsPaused(false);
    setPhase("focus");
  }, []);

  const togglePause = useCallback(() => {
    if (phase !== "focus") return;
    setIsPaused((wasPaused) => {
      if (wasPaused) {
        const pausedFor = Date.now() - pausedAtRef.current;
        phaseEndsAtRef.current += pausedFor;
      } else {
        pausedAtRef.current = Date.now();
      }
      return !wasPaused;
    });
  }, [phase]);

  useEffect(() => {
    if (phase !== "focus" || isPaused) return;
    const id = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.round((phaseEndsAtRef.current - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
      if (remaining > 0) {
        setFocusElapsed((e) => e + 1);
      }
      if (remaining <= 0) {
        setIsTimerComplete(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, isPaused]);

  const showSessionError = useCallback(
    (err: unknown) => {
      showErrorToast({
        title: tCommon("error_title"),
        message:
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : tCommon("error_unknown"),
        duration: 3000,
      });
    },
    [showErrorToast, tCommon],
  );

  const startSession = useCallback(async () => {
    setBusy(true);
    try {
      const preset = selectedPresetRef.current;
      const started = await startStudySession(
        preset === "custom"
          ? { preset: "custom", focusMinutes: focusMinutes }
          : { preset },
      );
      setSession(started);
      setFocusElapsed(0);
      beginFocus(presetSeconds(focusMinutes));
    } catch (err) {
      showSessionError(err);
    } finally {
      setBusy(false);
    }
  }, [focusMinutes, beginFocus, showSessionError]);

  const finalize = useCallback(
    async (status: "COMPLETED" | "ABANDONED") => {
      if (!session) return;
      setBusy(true);
      try {
        await finalizeStudySession(session.id, {
          status,
          actualFocusSeconds: focusElapsed,
        });
        setPhase("done");
      } catch (err) {
        showSessionError(err);
      } finally {
        setBusy(false);
      }
    },
    [session, focusElapsed, showSessionError],
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setSession(null);
    setFocusElapsed(0);
    setSecondsLeft(0);
    setIsPaused(false);
    setIsTimerComplete(false);
  }, []);

  const selectPreset = useCallback(
    (presetId: "25_5" | "50_10", minutes: number) => {
      selectedPresetRef.current = presetId;
      setFocusMinutesState(minutes);
    },
    [],
  );

  return {
    phase,
    focusMinutes,
    setFocusMinutes,
    selectPreset,
    secondsLeft,
    focusElapsed,
    isPaused,
    isTimerComplete,
    session,
    busy,
    startSession,
    togglePause,
    finalize,
    reset,
  };
}
