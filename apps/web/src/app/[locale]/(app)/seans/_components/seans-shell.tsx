"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type {
  FocusGoalDto,
  QuestProgressView,
  SessionPresetDto,
  TodayPanelResponse,
} from "@mentor/types";
import { ApiClientError, coachingControllerGetToday } from "@mentor/api-client";
import { Card } from "@mentor/ui";
import { fetchQuests, isEconomyDisabled } from "@/lib/economy";
import { parsePlanTaskContextFromParams } from "@/lib/plan-seans-link";
import { readActiveSession, resolveResume } from "@/lib/session-persistence";
import { SessionAmbientPicker } from "./session-ambient-picker";
import { SessionAmbientToggle } from "./session-ambient-toggle";
import { SessionControls } from "./session-controls";
import { SessionBuddyCard } from "./session-buddy-card";
import { SessionDoneState } from "./session-done-state";
import { SessionFocusGoalCard } from "./session-focus-goal-card";
import { SessionHistory } from "./session-history";
import { SessionSubjectPicker } from "./session-subject-picker";
import { SessionTimerRing } from "./session-timer-ring";
import { useSessionAmbientSound } from "./use-session-ambient-sound";
import { useSessionTimer } from "./use-session-timer";

const DEFAULT_PRESETS: SessionPresetDto[] = [
  { id: "25_5", label: "25 / 5 dk", focusMinutes: 25, breakMinutes: 5 },
  { id: "50_10", label: "50 / 10 dk", focusMinutes: 50, breakMinutes: 10 },
];

function parseInitialMinutes(
  presetParam: string | null,
  minutesParam: string | null,
): number {
  if (minutesParam) {
    const n = Number.parseInt(minutesParam, 10);
    if (!Number.isNaN(n) && n >= 5 && n <= 120 && n % 5 === 0) return n;
  }
  if (presetParam === "50_10") return 50;
  return 25;
}

function parseInitialBreakMinutes(
  presetParam: string | null,
  minutesParam: string | null,
): number {
  if (minutesParam) {
    const n = Number.parseInt(minutesParam, 10);
    if (!Number.isNaN(n) && n >= 5 && n <= 120 && n % 5 === 0) return 5;
  }
  if (presetParam === "50_10") return 10;
  return 5;
}

function parseInitialPreset(
  presetParam: string | null,
  minutesParam: string | null,
): "25_5" | "50_10" | "custom" {
  if (minutesParam) {
    const n = Number.parseInt(minutesParam, 10);
    if (!Number.isNaN(n) && n >= 5 && n <= 120 && n % 5 === 0) return "custom";
  }
  if (presetParam === "50_10") return "50_10";
  return "25_5";
}

function parseInitialSelectedPresetId(
  presetParam: string | null,
  minutesParam: string | null,
): string | null {
  if (minutesParam) {
    const n = Number.parseInt(minutesParam, 10);
    if (!Number.isNaN(n) && n >= 5 && n <= 120 && n % 5 === 0) return null;
  }
  if (presetParam === "50_10") return "50_10";
  return "25_5";
}

/** Persisted session the timer hook will actually resume (not stale/finished). */
function readRestorableRecord() {
  const record = readActiveSession();
  if (!record) return null;
  const kind = resolveResume(record, Date.now()).kind;
  return kind === "discard" || kind === "done" ? null : record;
}

function unwrapTodayResponse(response: unknown): TodayPanelResponse {
  return ((response as { data?: TodayPanelResponse }).data ?? response) as TodayPanelResponse;
}

/** Calm pastel backdrop for the immersive focus/break view (DESIGN.md blobs, softened). */
function ImmersiveBackdrop() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div
        className="absolute -left-24 -top-24 h-96 w-96 rounded-full opacity-30 blur-[150px]"
        style={{ backgroundColor: "#FF2DAB" }}
      />
      <div
        className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full opacity-50 blur-[150px]"
        style={{ backgroundColor: "#9BC1FB" }}
      />
      <div
        className="absolute -bottom-32 left-1/4 h-96 w-96 rounded-full opacity-50 blur-[150px]"
        style={{ backgroundColor: "#BDEBFF" }}
      />
    </div>
  );
}

function SetupStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5">
      <span
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--color-secondary)" }}
      >
        {label}
      </span>
      <span
        className="text-sm font-bold tabular-nums"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        {value}
      </span>
    </div>
  );
}

function PlanTaskContextChip({ title }: { title: string }) {
  return (
    <span
      className="max-w-full truncate rounded-full px-3 py-1 text-xs font-semibold"
      style={{
        backgroundColor: "color-mix(in srgb, var(--color-progress) 14%, transparent)",
        color: "var(--color-main)",
        fontFamily: "var(--font-body)",
      }}
      title={title}
    >
      {title}
    </span>
  );
}

/**
 * Pomodoro session UI — setup dial (idle), immersive focus/break, done summary.
 */
export function SeansShell() {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("session");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const presetParam = searchParams.get("preset");
  const minutesParam = searchParams.get("minutes");
  const subjectParam = searchParams.get("subject");
  const taskTitleParam = searchParams.get("taskTitle");
  const taskIdParam = searchParams.get("taskId");
  // Resume context (subject / plan-task chips) survives a reload alongside the timer.
  const [restored] = useState(readRestorableRecord);
  const [subject, setSubject] = useState<string | null>(() =>
    subjectParam?.trim() ? subjectParam.trim() : (restored?.subject ?? null),
  );
  const [planTaskContext, setPlanTaskContext] = useState(() => {
    const fromParams = parsePlanTaskContextFromParams({
      taskTitle: taskTitleParam,
      taskId: taskIdParam,
    });
    if (fromParams.taskId || fromParams.taskTitle) return fromParams;
    return {
      taskTitle: restored?.planTaskTitle ?? null,
      taskId: restored?.planTaskId ?? null,
    };
  });

  const [presets, setPresets] = useState<SessionPresetDto[]>(DEFAULT_PRESETS);
  const [presetNotice, setPresetNotice] = useState<string | null>(null);
  const [focusGoal, setFocusGoal] = useState<FocusGoalDto | null>(null);
  const [focusingNow, setFocusingNow] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(() =>
    parseInitialSelectedPresetId(presetParam, minutesParam),
  );
  const [questBaseline, setQuestBaseline] = useState<QuestProgressView[] | null>(null);
  const [streakBaseline, setStreakBaseline] = useState<number | null>(null);

  const timer = useSessionTimer({
    initialMinutes: parseInitialMinutes(presetParam, minutesParam),
    initialBreakMinutes: parseInitialBreakMinutes(presetParam, minutesParam),
    initialPreset: parseInitialPreset(presetParam, minutesParam),
    subject,
    planTaskId: planTaskContext.taskId,
    planTaskTitle: planTaskContext.taskTitle,
  });

  // Fetched on mount and re-fetched whenever the timer returns to idle, so the
  // focus-goal progress reflects the session that just finished.
  const timerPhase = timer.phase;
  useEffect(() => {
    if (timerPhase !== "idle") return;
    let active = true;
    coachingControllerGetToday()
      .then((res) => {
        if (!active) return;
        const data = res as {
          sessionPresets?: SessionPresetDto[];
          focusGoal?: FocusGoalDto;
          focusingNow?: number | null;
        };
        if (data.sessionPresets?.length) {
          setPresets(data.sessionPresets);
          setPresetNotice(null);
        }
        if (data.focusGoal) setFocusGoal(data.focusGoal);
        setFocusingNow(data.focusingNow ?? null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setPresets(DEFAULT_PRESETS);
        setPresetNotice(
          err instanceof ApiClientError ? err.message : t("preset_fallback"),
        );
      });
    return () => {
      active = false;
    };
  }, [timerPhase, t]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const {
    phase,
    focusMinutes,
    breakMinutes,
    secondsLeft,
    focusElapsed,
    isPaused,
    busy,
    session,
    setFocusMinutes,
    selectPreset,
    startSession,
    togglePause,
    finalize,
    recordFeedback,
    skipBreak,
    reset,
  } = timer;

  const ambient = useSessionAmbientSound({ phase, isPaused });

  // Countdown in the tab title while focus/break runs (visible from other tabs).
  const initialTitleRef = useRef<string | null>(null);
  useEffect(() => {
    initialTitleRef.current ??= document.title;
    if (phase === "focus" || phase === "break") {
      const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
      const ss = String(secondsLeft % 60).padStart(2, "0");
      const label =
        phase === "break"
          ? t("break_label")
          : isPaused
            ? t("paused")
            : t("focusing");
      document.title = `${mm}:${ss} · ${label} — Mentor`;
    } else {
      document.title = initialTitleRef.current;
    }
  }, [phase, secondsLeft, isPaused, t]);
  useEffect(
    () => () => {
      if (initialTitleRef.current) document.title = initialTitleRef.current;
    },
    [],
  );

  const handleStartSession = async () => {
    try {
      const [questsResult, todayResult] = await Promise.all([
        fetchQuests().catch((err) => (isEconomyDisabled(err) ? null : Promise.reject(err))),
        coachingControllerGetToday(),
      ]);
      setQuestBaseline(questsResult);
      setStreakBaseline(unwrapTodayResponse(todayResult).streak.currentStreak);
    } catch {
      setQuestBaseline(null);
      setStreakBaseline(null);
    }
    await startSession();
  };

  const handleReset = () => {
    setQuestBaseline(null);
    setStreakBaseline(null);
    setPlanTaskContext({ taskTitle: null, taskId: null });
    reset();
  };

  const handleMinutesChange = (minutes: number) => {
    setFocusMinutes(minutes);
    setSelectedPresetId(null);
  };

  const handlePresetSelect = (
    presetId: "25_5" | "50_10",
    minutes: number,
    breakLen: number,
  ) => {
    selectPreset(presetId, minutes, breakLen);
    setSelectedPresetId(presetId);
  };

  const phaseMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.25, ease: "easeOut" as const },
        },
        exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
      };

  const subjectChip = subject ? (
    <span
      className="rounded-[var(--radius-card)] px-3 py-1 text-xs font-bold uppercase tracking-wide"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--color-chip) 30%, transparent)",
        color: "var(--color-chip-text)",
        fontFamily: "var(--font-body)",
      }}
    >
      {subject}
    </span>
  ) : null;

  const planTaskTitle = planTaskContext.taskTitle;
  const planTaskChip = planTaskTitle ? (
    <PlanTaskContextChip title={t("from_plan_task", { title: planTaskTitle })} />
  ) : null;

  const contextChips =
    subjectChip || planTaskChip ? (
      <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
        {planTaskChip}
        {subjectChip}
      </div>
    ) : null;

  const phaseLabel =
    phase === "break"
      ? t("break_label")
      : isPaused
        ? t("paused")
        : t("focusing");

  const estimatedFinish = new Date(
    now + (focusMinutes + breakMinutes) * 60_000,
  ).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  const setupSummary = (
    <div
      className="flex w-full items-center rounded-[var(--radius-card)] px-1 py-2.5"
      style={{
        backgroundColor: "color-mix(in srgb, var(--color-chip) 18%, transparent)",
      }}
    >
      <SetupStat
        label={t("summary_focus")}
        value={t("minutes_value", { minutes: focusMinutes })}
      />
      <span
        aria-hidden
        className="h-7 w-px shrink-0"
        style={{ backgroundColor: "var(--color-progress-track)" }}
      />
      <SetupStat
        label={t("summary_break")}
        value={t("minutes_value", { minutes: breakMinutes })}
      />
      <span
        aria-hidden
        className="h-7 w-px shrink-0"
        style={{ backgroundColor: "var(--color-progress-track)" }}
      />
      <SetupStat label={t("summary_finish")} value={estimatedFinish} />
    </div>
  );

  // Immersive focus/break view — covers the app nav (z-30 over the z-20 shell).
  if (phase === "focus" || phase === "break") {
    return (
      <div className="fixed inset-0 z-30 flex flex-col items-center justify-center px-5 py-8">
        <ImmersiveBackdrop />
        <motion.div
          key={phase}
          className="relative flex w-full max-w-sm flex-col items-center gap-6"
          {...phaseMotion}
        >
          {contextChips}
          <p
            className="text-sm font-semibold uppercase tracking-wide"
            style={{
              color: "var(--color-secondary)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {phaseLabel}
          </p>
          <SessionTimerRing
            phase={phase}
            focusMinutes={focusMinutes}
            breakMinutes={breakMinutes}
            secondsLeft={secondsLeft}
            presets={presets}
            selectedPresetId={selectedPresetId}
            onMinutesChange={handleMinutesChange}
            onPresetSelect={handlePresetSelect}
          />
          <div className="flex items-center justify-center gap-3">
            {ambient.trackId !== "off" ? (
              <SessionAmbientToggle
                muted={ambient.muted}
                onToggleMute={ambient.toggleMute}
              />
            ) : null}
            <SessionControls
              phase={phase}
              busy={busy}
              isPaused={isPaused}
              onStart={() => void handleStartSession()}
              onTogglePause={togglePause}
              onComplete={() => void finalize("COMPLETED")}
              onAbandon={() => void finalize("ABANDONED")}
              onSkipBreak={skipBreak}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 py-8 lg:px-8 lg:py-10">
      <motion.header
        {...(reduceMotion
          ? {}
          : {
              initial: { opacity: 0, y: 8 },
              animate: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.3, ease: "easeOut" as const },
              },
            })}
      >
        <h1
          className="text-3xl font-bold"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {t("title")}
        </h1>
        <p className="mt-1 text-base" style={{ color: "var(--color-secondary)" }}>
          {t("subtitle")}
        </p>
        {focusingNow !== null && (
          <p
            className="mt-2 flex items-center gap-1.5 text-sm"
            style={{ color: "var(--color-secondary)" }}
          >
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: "var(--color-progress)" }}
            />
            {t("focusing_now", { count: focusingNow })}
          </p>
        )}
      </motion.header>

      {presetNotice && (
        <p
          className="text-sm"
          style={{ color: "var(--color-secondary)" }}
          role="status"
        >
          {presetNotice}
        </p>
      )}

      <Card className="flex flex-col items-center gap-5 px-5 py-8 sm:px-8 sm:py-10">
        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.div
              key="idle"
              className="flex w-full flex-col items-center gap-5"
              {...phaseMotion}
            >
              <SessionSubjectPicker
                value={subject ?? ""}
                onChange={(v) => setSubject(v.trim() ? v.trim() : null)}
              />
              {planTaskChip ? (
                <div className="flex w-full justify-center">{planTaskChip}</div>
              ) : null}
              <SessionAmbientPicker
                trackId={ambient.trackId}
                onTrackIdChange={ambient.setTrackId}
              />
              <SessionTimerRing
                phase={phase}
                focusMinutes={focusMinutes}
                breakMinutes={breakMinutes}
                secondsLeft={secondsLeft}
                presets={presets}
                selectedPresetId={selectedPresetId}
                onMinutesChange={handleMinutesChange}
                onPresetSelect={handlePresetSelect}
              />
              {setupSummary}
              <SessionControls
                phase={phase}
                busy={busy}
                isPaused={isPaused}
                onStart={() => void handleStartSession()}
                onTogglePause={togglePause}
                onComplete={() => void finalize("COMPLETED")}
                onAbandon={() => void finalize("ABANDONED")}
                onSkipBreak={skipBreak}
              />
            </motion.div>
          )}

          {phase === "done" && (
            <motion.div key="done" className="w-full" {...phaseMotion}>
              <SessionDoneState
                focusElapsed={focusElapsed}
                sessionId={session?.id ?? null}
                subject={subject}
                questBaseline={questBaseline}
                streakBaseline={streakBaseline}
                countsAsFocusSession={session?.countsAsFocusSession ?? true}
                sessionStatus={session?.status ?? null}
                planTaskAutoCompleted={session?.planTaskAutoCompleted ?? false}
                onSubmitFeedback={recordFeedback}
                onReset={handleReset}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {phase === "idle" && (
        <SessionFocusGoalCard
          focusGoal={focusGoal}
          onGoalChange={(goalMinutes) =>
            setFocusGoal((g) => ({
              goalMinutes,
              focusMinutesToday: g?.focusMinutesToday ?? 0,
            }))
          }
        />
      )}
      {phase === "idle" && <SessionBuddyCard />}
      {phase === "idle" && <SessionHistory />}
    </main>
  );
}
