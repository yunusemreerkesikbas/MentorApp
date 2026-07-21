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
import {
  clearActiveSession,
  readActiveSession,
  resolveResume,
  writeActiveSession,
} from "@/lib/session-persistence";
import { useMentorToast } from "@/lib/mentor-toast";
import { playChime, unlockChime } from "./session-chime";

export type SessionPhase = "idle" | "focus" | "break" | "done";

/** Break length for custom (free-duration) sessions; fixed presets carry their own. */
const CUSTOM_BREAK_MINUTES = 5;

export interface UseSessionTimerOptions {
  initialMinutes?: number;
  initialBreakMinutes?: number;
  initialPreset?: "25_5" | "50_10" | "custom";
  /** Optional subject carried from a plan task deep-link. */
  subject?: string | null;
  /** Optional plan task id from a plan → seans deep-link (persisted on start). */
  planTaskId?: string | null;
  /** Optional plan task title — only persisted so the chip survives a reload. */
  planTaskTitle?: string | null;
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
  startSession: () => Promise<boolean>;
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
    planTaskId = null,
    planTaskTitle = null,
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
  const focusElapsedRef = useRef(0);
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

  // Resume a persisted session once on mount (reload / in-app navigation).
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const record = readActiveSession();
    if (!record) return;
    const resolution = resolveResume(record, Date.now());
    if (resolution.kind === "discard" || resolution.kind === "done") {
      clearActiveSession();
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore external storage once
    setFocusMinutesState(record.focusMinutes);
    focusMinutesRef.current = record.focusMinutes;
    setBreakMinutesState(record.breakMinutes);
    breakMinutesRef.current = record.breakMinutes;
    selectedPresetRef.current = record.preset;
    if (resolution.kind === "finalize-expired") {
      setBusy(true);
      finalizeStudySession(record.sessionId, {
        status: "COMPLETED",
        actualFocusSeconds: resolution.creditSeconds,
      })
        .then((finalized) => {
          // Clear only once the credit is safely persisted (or provably gone, below) —
          // a transient failure keeps the record so the next mount retries.
          clearActiveSession();
          setSession(finalized);
          sessionRef.current = finalized;
          focusElapsedRef.current = resolution.creditSeconds;
          setFocusElapsed(resolution.creditSeconds);
          setPhase("done");
        })
        .catch((err: unknown) => {
          // Already closed elsewhere (stale-cleanup / another device) — stay idle.
          if (
            err instanceof ApiClientError &&
            (err.status === 409 || err.status === 404)
          ) {
            clearActiveSession();
            return;
          }
          showSessionError(err);
        })
        .finally(() => setBusy(false));
      return;
    }
    const stub = { id: record.sessionId } as StudySessionDto;
    setSession(stub);
    sessionRef.current = stub;
    advanceRef.current = false;
    phaseEndsAtRef.current = record.phaseEndsAt;
    if (record.isPaused && record.pausedAt !== null) {
      pausedAtRef.current = record.pausedAt;
      setIsPaused(true);
    }
    setSecondsLeft(resolution.secondsLeft);
    if (resolution.kind === "resume-focus") {
      const elapsed =
        presetSeconds(record.focusMinutes) - resolution.secondsLeft;
      focusElapsedRef.current = elapsed;
      setFocusElapsed(elapsed);
      setPhase("focus");
    } else {
      focusElapsedRef.current = record.focusElapsed;
      setFocusElapsed(record.focusElapsed);
      setPhase("break");
    }
  }, [showSessionError]);

  // Persist the running session on every tick / pause / phase change so a
  // reload (or navigating away) can resume it.
  useEffect(() => {
    if (phase !== "focus" && phase !== "break") return;
    const current = sessionRef.current;
    if (!current) return;
    writeActiveSession({
      sessionId: current.id,
      phase,
      phaseEndsAt: phaseEndsAtRef.current,
      isPaused,
      pausedAt: isPaused ? pausedAtRef.current : null,
      focusMinutes: focusMinutesRef.current,
      breakMinutes: breakMinutesRef.current,
      preset: selectedPresetRef.current,
      subject,
      planTaskId,
      planTaskTitle,
      focusElapsed: focusElapsedRef.current,
      savedAt: Date.now(),
    });
  }, [phase, isPaused, secondsLeft, subject, planTaskId, planTaskTitle]);

  useEffect(() => {
    if ((phase !== "focus" && phase !== "break") || isPaused) return;
    const id = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.round((phaseEndsAtRef.current - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
      if (phase === "focus") {
        // Wall-clock derivation: pauses shift phaseEndsAt, so remaining already
        // excludes paused time; robust against background-tab timer throttling.
        const elapsed = presetSeconds(focusMinutesRef.current) - remaining;
        focusElapsedRef.current = elapsed;
        setFocusElapsed(elapsed);
      }
      if (remaining <= 0 && !advanceRef.current) {
        advanceRef.current = true;
        clearInterval(id);
        if (phase === "focus") {
          playChime();
          const completed = sessionRef.current;
          if (completed) {
            setBusy(true);
            finalizeStudySession(completed.id, {
              status: "COMPLETED",
              actualFocusSeconds: focusElapsedRef.current,
            })
              .then((finalized) => {
                setSession(finalized);
                sessionRef.current = finalized;
              })
              .catch(showSessionError)
              .finally(() => setBusy(false));
          }
          const breakLen = presetSeconds(breakMinutesRef.current);
          if (breakLen > 0) {
            beginPhase("break", breakLen);
          } else {
            clearActiveSession();
            setPhase("done");
          }
        } else {
          clearActiveSession();
          setPhase("done");
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, isPaused, beginPhase, showSessionError]);

  const startSession = useCallback(async () => {
    unlockChime(); // within the click gesture, so the end-of-focus chime can play
    setBusy(true);
    try {
      const preset = selectedPresetRef.current;
      const trimmedSubject = subject?.trim() ? subject.trim() : undefined;
      const trimmedPlanTaskId = planTaskId?.trim()
        ? planTaskId.trim()
        : undefined;
      const shared = {
        subject: trimmedSubject,
        ...(trimmedPlanTaskId ? { planTaskId: trimmedPlanTaskId } : {}),
      };
      const started = await startStudySession(
        preset === "custom"
          ? { preset: "custom", focusMinutes, ...shared }
          : { preset, ...shared },
      );
      setSession(started);
      sessionRef.current = started;
      focusElapsedRef.current = 0;
      setFocusElapsed(0);
      beginPhase("focus", presetSeconds(focusMinutes));
      return true;
    } catch (err) {
      showSessionError(err);
      return false;
    } finally {
      setBusy(false);
    }
  }, [focusMinutes, subject, planTaskId, beginPhase, showSessionError]);

  const finalize = useCallback(
    async (status: "COMPLETED" | "ABANDONED") => {
      if (!session) return;
      setBusy(true);
      try {
        const finalized = await finalizeStudySession(session.id, {
          status,
          actualFocusSeconds: focusElapsedRef.current,
        });
        setSession(finalized);
        sessionRef.current = finalized;
        clearActiveSession();
        setPhase("done");
      } catch (err) {
        showSessionError(err);
      } finally {
        setBusy(false);
      }
    },
    [session, showSessionError],
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
    clearActiveSession();
    setPhase("done");
  }, []);

  const reset = useCallback(() => {
    clearActiveSession();
    setPhase("idle");
    setSession(null);
    sessionRef.current = null;
    focusElapsedRef.current = 0;
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
