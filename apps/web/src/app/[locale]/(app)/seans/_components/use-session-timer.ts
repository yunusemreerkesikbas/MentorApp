"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { StudySessionDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import {
  finalizeStudySession,
  recordSessionFeedback,
  startStudySession,
} from "@/lib/study-sessions";
import { useMentorToast } from "@/lib/mentor-toast";

export type SessionPhase = "idle" | "focus" | "break" | "done";

/** Break length for custom (free-duration) sessions; fixed presets carry their own. */
const CUSTOM_BREAK_MINUTES = 5;

export interface UseSessionTimerOptions {
  initialMinutes?: number;
  initialBreakMinutes?: number;
  initialPreset?: "25_5" | "50_10" | "custom";
  /** Optional subject carried from a plan task deep-link. */
  subject?: string | null;
}

export interface UseSessionTimerResult {
  phase: SessionPhase;
  focusMinutes: number;
  breakMinutes: number;
  setFocusMinutes: (minutes: number) => void;
  selectPreset: (
    presetId: "25_5" | "50_10",
    minutes: number,
    breakMinutes: number,
  ) => void;
  secondsLeft: number;
  focusElapsed: number;
  isPaused: boolean;
  session: StudySessionDto | null;
  busy: boolean;
  startSession: () => Promise<void>;
  togglePause: () => void;
  finalize: (status: "COMPLETED" | "ABANDONED") => Promise<void>;
  recordFeedback: (mood: number, struggleNote?: string) => Promise<void>;
  skipBreak: () => void;
  reset: () => void;
}

function presetSeconds(minutes: number): number {
  return minutes * 60;
}

/**
 * Client-side Pomodoro timer: focus -> break -> done.
 * Focus end auto-persists the session as COMPLETED and starts a (skippable) break.
 * The break phase is purely client-side (no DB concept) — a calm cooldown, not a tracked entity.
 */
export function useSessionTimer(
  options: UseSessionTimerOptions = {},
): UseSessionTimerResult {
  const {
    initialMinutes = 25,
    initialBreakMinutes = 5,
    initialPreset = "25_5",
    subject = null,
  } = options;
  const tCommon = useTranslations("common");
  const { error: showErrorToast } = useMentorToast();

  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [focusMinutes, setFocusMinutesState] = useState(initialMinutes);
  const [breakMinutes, setBreakMinutesState] = useState(initialBreakMinutes);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [focusElapsed, setFocusElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [session, setSession] = useState<StudySessionDto | null>(null);
  const [busy, setBusy] = useState(false);

  const phaseEndsAtRef = useRef(0);
  const pausedAtRef = useRef(0);
  const advanceRef = useRef(false);
  const selectedPresetRef = useRef<"25_5" | "50_10" | "custom">(initialPreset);
  const focusMinutesRef = useRef(initialMinutes);
  const breakMinutesRef = useRef(initialBreakMinutes);
  const sessionRef = useRef<StudySessionDto | null>(null);

  const setFocusMinutes = useCallback((minutes: number) => {
    setFocusMinutesState(minutes);
    focusMinutesRef.current = minutes;
    selectedPresetRef.current = "custom";
    setBreakMinutesState(CUSTOM_BREAK_MINUTES);
    breakMinutesRef.current = CUSTOM_BREAK_MINUTES;
  }, []);

  const selectPreset = useCallback(
    (presetId: "25_5" | "50_10", minutes: number, breakLen: number) => {
      selectedPresetRef.current = presetId;
      setFocusMinutesState(minutes);
      focusMinutesRef.current = minutes;
      setBreakMinutesState(breakLen);
      breakMinutesRef.current = breakLen;
    },
    [],
  );

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

  const beginPhase = useCallback((next: "focus" | "break", seconds: number) => {
    phaseEndsAtRef.current = Date.now() + seconds * 1000;
    advanceRef.current = false;
    setSecondsLeft(seconds);
    setIsPaused(false);
    setPhase(next);
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused((wasPaused) => {
      if (wasPaused) {
        const pausedFor = Date.now() - pausedAtRef.current;
        phaseEndsAtRef.current += pausedFor;
      } else {
        pausedAtRef.current = Date.now();
      }
      return !wasPaused;
    });
  }, []);

  useEffect(() => {
    if ((phase !== "focus" && phase !== "break") || isPaused) return;
    const id = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.round((phaseEndsAtRef.current - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
      if (phase === "focus" && remaining > 0) {
        setFocusElapsed((e) => e + 1);
      }
      if (remaining <= 0 && !advanceRef.current) {
        advanceRef.current = true;
        clearInterval(id);
        if (phase === "focus") {
          const completed = sessionRef.current;
          if (completed) {
            setBusy(true);
            finalizeStudySession(completed.id, {
              status: "COMPLETED",
              actualFocusSeconds: presetSeconds(focusMinutesRef.current),
            })
              .catch(showSessionError)
              .finally(() => setBusy(false));
          }
          const breakLen = presetSeconds(breakMinutesRef.current);
          if (breakLen > 0) beginPhase("break", breakLen);
          else setPhase("done");
        } else {
          setPhase("done");
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, isPaused, beginPhase, showSessionError]);

  const startSession = useCallback(async () => {
    setBusy(true);
    try {
      const preset = selectedPresetRef.current;
      const trimmedSubject = subject?.trim() ? subject.trim() : undefined;
      const started = await startStudySession(
        preset === "custom"
          ? { preset: "custom", focusMinutes, subject: trimmedSubject }
          : { preset, subject: trimmedSubject },
      );
      setSession(started);
      sessionRef.current = started;
      setFocusElapsed(0);
      beginPhase("focus", presetSeconds(focusMinutes));
    } catch (err) {
      showSessionError(err);
    } finally {
      setBusy(false);
    }
  }, [focusMinutes, subject, beginPhase, showSessionError]);

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

  const recordFeedback = useCallback(
    async (mood: number, struggleNote?: string) => {
      const current = sessionRef.current;
      if (!current) return;
      try {
        await recordSessionFeedback(current.id, { mood, struggleNote });
      } catch (err) {
        showSessionError(err);
        throw err;
      }
    },
    [showSessionError],
  );

  const skipBreak = useCallback(() => {
    advanceRef.current = true;
    setPhase("done");
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setSession(null);
    sessionRef.current = null;
    setFocusElapsed(0);
    setSecondsLeft(0);
    setIsPaused(false);
    advanceRef.current = false;
  }, []);

  return {
    phase,
    focusMinutes,
    breakMinutes,
    setFocusMinutes,
    selectPreset,
    secondsLeft,
    focusElapsed,
    isPaused,
    session,
    busy,
    startSession,
    togglePause,
    finalize,
    recordFeedback,
    skipBreak,
    reset,
  };
}
