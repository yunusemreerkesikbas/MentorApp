"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  SESSION_ACTUAL_SECONDS_MAX,
  type SessionPresetId,
  type StudySessionDto,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import {
  finalizeStudySession,
  recordSessionFeedback,
  startStudySession,
} from "@/lib/study-sessions";
import {
  clearActiveSession,
  writeActiveSession,
} from "@/lib/session-persistence";
import { useMentorToast } from "@/lib/mentor-toast";
import { useSessionRestoration } from "./use-session-restoration";
import { playChime, unlockChime } from "./session-chime";

export type SessionPhase = "idle" | "focus" | "break" | "done";

/** Break length for custom (free-duration) sessions; fixed presets carry their own. */
const CUSTOM_BREAK_MINUTES = 5;

export interface UseSessionTimerOptions {
  initialMinutes?: number;
  initialBreakMinutes?: number;
  initialPreset?: SessionPresetId;
  /** Optional subject carried from a plan task deep-link. */
  subject?: string | null;
  /** Optional plan task id from a plan → seans deep-link (persisted on start). */
  planTaskId?: string | null;
  /** Optional plan task title — only persisted so the chip survives a reload. */
  planTaskTitle?: string | null;
  /** Study room to sit down at; null = solo. Fixed at start — no table-hopping mid-focus. */
  roomId?: string | null;
  /** Session already created by an explicitly accepted coach action. */
  existingSessionId?: string | null;
  /** Enter focus immediately for the accepted coach action. */
  autoStartExisting?: boolean;
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
  isStopwatch: boolean;
  selectStopwatch: () => void;
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
    roomId = null,
    existingSessionId = null,
    autoStartExisting = false,
  } = options;
  const tCommon = useTranslations("common");
  const { error: showErrorToast } = useMentorToast();

  const [isStopwatch, setIsStopwatch] = useState(initialPreset === "stopwatch");
  const stopwatchStartedAtRef = useRef(0);
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
  const selectedPresetRef = useRef<SessionPresetId>(initialPreset);
  const focusMinutesRef = useRef(initialMinutes);
  const breakMinutesRef = useRef(initialBreakMinutes);
  const sessionRef = useRef<StudySessionDto | null>(null);

  const setFocusMinutes = useCallback((minutes: number) => {
    setFocusMinutesState(minutes);
    focusMinutesRef.current = minutes;
    selectedPresetRef.current = "custom";
    setIsStopwatch(false);
    setBreakMinutesState(CUSTOM_BREAK_MINUTES);
    breakMinutesRef.current = CUSTOM_BREAK_MINUTES;
  }, []);

  const selectPreset = useCallback(
    (presetId: "25_5" | "50_10", minutes: number, breakLen: number) => {
      selectedPresetRef.current = presetId;
      setIsStopwatch(false);
      setFocusMinutesState(minutes);
      focusMinutesRef.current = minutes;
      setBreakMinutesState(breakLen);
      breakMinutesRef.current = breakLen;
    },
    [],
  );

  const selectStopwatch = useCallback(() => {
    selectedPresetRef.current = "stopwatch";
    setIsStopwatch(true);
    setBreakMinutesState(0);
    breakMinutesRef.current = 0;
  }, []);

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
    stopwatchStartedAtRef.current = Date.now();
    phaseEndsAtRef.current = Date.now() + seconds * 1000;
    advanceRef.current = false;
    setSecondsLeft(seconds);
    setIsPaused(false);
    setPhase(next);
  }, []);

  const togglePause = useCallback(() => {
    const now = Date.now();
    if (isPaused) {
      const pausedFor = now - pausedAtRef.current;
      phaseEndsAtRef.current += pausedFor;
      stopwatchStartedAtRef.current += pausedFor;
    } else {
      pausedAtRef.current = now;
      if (selectedPresetRef.current === "stopwatch") {
        const elapsed = Math.max(
          0,
          Math.floor((now - stopwatchStartedAtRef.current) / 1000),
        );
        focusElapsedRef.current = elapsed;
        setFocusElapsed(elapsed);
      }
    }
    setIsPaused(!isPaused);
  }, [isPaused]);

  useSessionRestoration({
    existingSessionId,
    autoStartExisting,
    onBusy: setBusy,
    onError: showSessionError,
    onExisting: (id) => {
      const stub = { id } as StudySessionDto;
      setSession(stub);
      sessionRef.current = stub;
      beginPhase("focus", presetSeconds(focusMinutesRef.current));
    },
    onRecord: (record) => {
      setFocusMinutesState(record.focusMinutes);
      focusMinutesRef.current = record.focusMinutes;
      setBreakMinutesState(record.breakMinutes);
      breakMinutesRef.current = record.breakMinutes;
      selectedPresetRef.current = record.preset;
      setIsStopwatch(record.preset === "stopwatch");
    },
    onFinalized: (finalized) => {
      setSession(finalized);
      sessionRef.current = finalized;
      focusElapsedRef.current = finalized.actualFocusSeconds;
      setFocusElapsed(finalized.actualFocusSeconds);
      setPhase("done");
    },
    onResume: (record, resolution) => {
      const stub = { id: record.sessionId } as StudySessionDto;
      setSession(stub);
      sessionRef.current = stub;
      advanceRef.current = false;
      phaseEndsAtRef.current = record.phaseEndsAt;
      if (record.isPaused && record.pausedAt !== null) {
        pausedAtRef.current = record.pausedAt;
        setIsPaused(true);
      }
      if (resolution.kind === "resume-stopwatch") {
        stopwatchStartedAtRef.current =
          (record.isPaused ? (record.pausedAt ?? Date.now()) : Date.now()) -
          resolution.elapsedSeconds * 1000;
        focusElapsedRef.current = resolution.elapsedSeconds;
        setFocusElapsed(resolution.elapsedSeconds);
        setPhase("focus");
        return;
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
    },
  });

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
  }, [
    phase,
    isPaused,
    secondsLeft,
    focusElapsed,
    subject,
    planTaskId,
    planTaskTitle,
  ]);

  useEffect(() => {
    if ((phase !== "focus" && phase !== "break") || isPaused) return;
    const id = setInterval(() => {
      if (phase === "focus" && selectedPresetRef.current === "stopwatch") {
        const elapsed = Math.max(
          0,
          Math.floor((Date.now() - stopwatchStartedAtRef.current) / 1000),
        );
        focusElapsedRef.current = elapsed;
        setFocusElapsed(elapsed);
        return;
      }
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
      const trimmedRoomId = roomId?.trim() ? roomId.trim() : undefined;
      const shared = {
        subject: trimmedSubject,
        ...(trimmedPlanTaskId ? { planTaskId: trimmedPlanTaskId } : {}),
        ...(trimmedRoomId ? { roomId: trimmedRoomId } : {}),
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
  }, [focusMinutes, subject, planTaskId, roomId, beginPhase, showSessionError]);

  const finalize = useCallback(
    async (status: "COMPLETED" | "ABANDONED") => {
      if (!session) return;
      setBusy(true);
      try {
        const finalized = await finalizeStudySession(session.id, {
          status,
          actualFocusSeconds:
            selectedPresetRef.current === "stopwatch"
              ? Math.min(
                  SESSION_ACTUAL_SECONDS_MAX,
                  Math.max(
                    0,
                    Math.floor(
                      ((isPaused ? pausedAtRef.current : Date.now()) -
                        stopwatchStartedAtRef.current) /
                        1000,
                    ),
                  ),
                )
              : focusElapsedRef.current,
        });
        setSession(finalized);
        sessionRef.current = finalized;
        focusElapsedRef.current = finalized.actualFocusSeconds;
        setFocusElapsed(finalized.actualFocusSeconds);
        clearActiveSession();
        setPhase("done");
      } catch (err) {
        showSessionError(err);
      } finally {
        setBusy(false);
      }
    },
    [session, isPaused, showSessionError],
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
    isStopwatch,
    selectStopwatch,
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
