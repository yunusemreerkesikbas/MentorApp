"use client";
import { History, PanelLeft } from "lucide-react";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
import {
  HistorySideDrawer,
  HistorySideRail,
} from "@/components/history-side-panel";
import { fetchQuests, isEconomyDisabled } from "@/lib/economy";
import { trackCoachEvent } from "@/lib/analytics";
import { parsePlanTaskContextFromParams } from "@/lib/plan-study-session-link";
import { readActiveSession, resolveResume } from "@/lib/session-persistence";
import { SessionAmbientPicker } from "./session-ambient-picker";
import { SessionBuddyCard } from "./session-buddy-card";
import { SessionControls } from "./session-controls";
import { SessionDoneState } from "./session-done-state";
import { SessionFocusBackdrop } from "./session-focus-backdrop";
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

const railIconBtn =
  "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_5%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none";

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
  return ((response as { data?: TodayPanelResponse }).data ??
    response) as TodayPanelResponse;
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
        style={{
          color: "var(--color-main)",
          fontFamily: "var(--font-heading)",
        }}
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
        backgroundColor:
          "color-mix(in srgb, var(--color-progress) 14%, transparent)",
        color: "var(--color-main)",
        fontFamily: "var(--font-body)",
      }}
      title={title}
    >
      {title}
    </span>
  );
}

function TimerChrome({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="min-w-0">{left}</div>
      <div className="min-w-0">{right}</div>
    </div>
  );
}

/**
 * Pomodoro session UI — setup dial (idle), immersive focus/break, done summary.
 */
export function StudySessionShell() {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("session");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const presetParam = searchParams.get("preset");
  const minutesParam = searchParams.get("minutes");
  const subjectParam = searchParams.get("subject");
  const taskTitleParam = searchParams.get("taskTitle");
  const taskIdParam = searchParams.get("taskId");
  const sessionIdParam = searchParams.get("sessionId");
  const autoStartExisting = searchParams.get("autostart") === "1";
  const sourceParam = searchParams.get("source");
  const coachSessionTrackedRef = useRef(false);
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
  const [questBaseline, setQuestBaseline] = useState<
    QuestProgressView[] | null
  >(null);
  const [streakBaseline, setStreakBaseline] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);

  const timer = useSessionTimer({
    initialMinutes: parseInitialMinutes(presetParam, minutesParam),
    initialBreakMinutes: parseInitialBreakMinutes(presetParam, minutesParam),
    initialPreset: parseInitialPreset(presetParam, minutesParam),
    subject,
    planTaskId: planTaskContext.taskId,
    planTaskTitle: planTaskContext.taskTitle,
    existingSessionId: sessionIdParam,
    autoStartExisting,
  });

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
        fetchQuests().catch((err) =>
          isEconomyDisabled(err) ? null : Promise.reject(err),
        ),
        coachingControllerGetToday(),
      ]);
      setQuestBaseline(questsResult);
      setStreakBaseline(unwrapTodayResponse(todayResult).streak.currentStreak);
    } catch {
      setQuestBaseline(null);
      setStreakBaseline(null);
    }
    const started = await startSession();
    if (
      started &&
      (sourceParam === "coach" || sourceParam === "dashboard") &&
      !coachSessionTrackedRef.current
    ) {
      coachSessionTrackedRef.current = true;
      trackCoachEvent("coach_session_start", { source: sourceParam });
    }
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

  const planTaskTitle = planTaskContext.taskTitle;
  const planTaskChip = planTaskTitle ? (
    <PlanTaskContextChip
      title={t("from_plan_task", { title: planTaskTitle })}
    />
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
        backgroundColor:
          "color-mix(in srgb, var(--color-chip) 18%, transparent)",
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

  const ambientPicker = (
    <SessionAmbientPicker
      trackId={ambient.trackId}
      muted={ambient.muted}
      onTrackIdChange={ambient.setTrackId}
      onToggleMute={ambient.toggleMute}
    />
  );

  const timerRing = (
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
  );

  const sessionControls = (
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
  );

  if (phase === "focus" || phase === "break") {
    return (
      <div className="session-focus-theme fixed inset-0 z-30 flex flex-col items-center justify-center px-5 py-8">
        <SessionFocusBackdrop />
        <motion.div
          key={phase}
          className="relative flex w-full max-w-sm flex-col items-center gap-6"
          {...phaseMotion}
        >
          <TimerChrome
            left={
              <SessionSubjectPicker
                value={subject ?? ""}
                onChange={(v) => setSubject(v.trim() ? v.trim() : null)}
                readOnly
              />
            }
            right={ambientPicker}
          />
          {planTaskChip}
          <p
            className="text-sm font-semibold uppercase tracking-wide"
            style={{
              color: "var(--color-secondary)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {phaseLabel}
          </p>
          {timerRing}
          {sessionControls}
        </motion.div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 py-8 lg:px-8 lg:py-10">
        <h1 className="sr-only">{t("title")}</h1>
        <Card className="flex flex-col items-center gap-5 px-5 py-8 sm:px-8 sm:py-10">
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
        </Card>
      </main>
    );
  }

  return (
    <main
      className="flex w-full min-h-[calc(100dvh-4rem-80px-env(safe-area-inset-bottom))] flex-col lg:h-[calc(100dvh-4rem)] lg:min-h-0 lg:flex-row lg:overflow-hidden"
      aria-label={t("title")}
    >
      <h1 className="sr-only">{t("title")}</h1>
      <HistorySideRail
        title={t("history_title")}
        railOpen={railOpen}
        onRailOpenChange={setRailOpen}
        expandLabel={t("history_open")}
        collapseLabel={t("history_collapse")}
        testId="session-history-rail"
        collapsedActions={
          <button
            type="button"
            onClick={() => setRailOpen(true)}
            className={railIconBtn}
            aria-label={t("history_title")}
            data-testid="session-history-rail-list"
          >
            <History
              className="size-5"
              style={{ color: "var(--color-main)" }}
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
        }
      >
        <SessionHistory />
      </HistorySideRail>

      <div className="flex min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-y-auto">
        <div className="flex items-center gap-2 px-5 pt-4 pb-1 lg:hidden">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-surface)_90%,transparent)] shadow-[var(--shadow-card)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
            aria-label={t("history_open")}
            data-testid="session-history-open"
          >
            <PanelLeft
              className="size-5"
              style={{ color: "var(--color-main)" }}
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-6 lg:px-8 lg:py-10">
          {presetNotice && (
            <p
              className="mb-4 text-sm"
              style={{ color: "var(--color-secondary)" }}
              role="status"
            >
              {presetNotice}
            </p>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key="idle"
              className="flex w-full flex-col items-center gap-5"
              {...phaseMotion}
            >
              <TimerChrome
                left={
                  <SessionSubjectPicker
                    value={subject ?? ""}
                    onChange={(v) => setSubject(v.trim() ? v.trim() : null)}
                  />
                }
                right={ambientPicker}
              />
              {planTaskChip}
              {timerRing}
              {setupSummary}
              {sessionControls}
              {focusingNow !== null ? (
                <p
                  className="flex items-center gap-1.5 text-center text-sm"
                  style={{ color: "var(--color-secondary)" }}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: "var(--color-progress)" }}
                  />
                  {t("focusing_now", { count: focusingNow })}
                </p>
              ) : null}
            </motion.div>
          </AnimatePresence>

        </div>
      </div>

      <aside
        className="flex w-full shrink-0 flex-col gap-4 px-5 pb-8 lg:h-full lg:w-72 lg:overflow-y-auto lg:border-l lg:p-4"
        style={{
          borderColor: "color-mix(in srgb, var(--color-main) 8%, transparent)",
        }}
      >
        <SessionFocusGoalCard
          focusGoal={focusGoal}
          onGoalChange={(goalMinutes) =>
            setFocusGoal((g) => ({
              goalMinutes,
              focusMinutesToday: g?.focusMinutesToday ?? 0,
            }))
          }
        />
        <SessionBuddyCard />
      </aside>

      <HistorySideDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        title={t("history_title")}
        testId="session-history-drawer"
      >
        <SessionHistory />
      </HistorySideDrawer>
    </main>
  );
}
