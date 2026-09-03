"use client";

import { History, PanelLeft } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type {
  FocusGoalDto,
  QuestProgressView,
  SessionPresetDto,
  StudyRoomTheme,
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
import { getStudyRoom, updateStudyRoom } from "@/lib/study-rooms";
import { ROOM_CURTAIN_MS, STUDY_ROOM_AMBIENT } from "@/lib/study-room-theme";
import {
  getServerSessionScene,
  getSessionScene,
  setSessionScene,
  subscribeSessionScene,
} from "@/lib/session-scene";
import {
  DEFAULT_PRESETS,
  parseInitialBreakMinutes,
  parseInitialMinutes,
  parseInitialPreset,
  parseInitialSelectedPresetId,
  readRestorableRecord,
  unwrapTodayResponse,
} from "./session-params";
import { PlanTaskContextChip, SessionTopBar } from "./session-top-bar";
import { SessionSetupSummary } from "./session-setup-summary";
import { SessionFocusView } from "./session-focus-view";
import { SessionBuddyCard } from "./session-buddy-card";
import { SessionControls } from "./session-controls";
import { SessionDoneState } from "./session-done-state";
import { RoomBackdropSlide } from "./room-backdrop-slide";
import { SessionFocusGoalCard } from "./session-focus-goal-card";
import { SessionHistory } from "./session-history";
import { SessionRoomList } from "./session-room-list";
import { SessionTimerRing } from "./session-timer-ring";
import { useSessionAmbientSound } from "./use-session-ambient-sound";
import { useSessionTimer } from "./use-session-timer";

/**
 * Pomodoro session UI — setup dial (idle), immersive focus/break, done summary.
 */
export function StudySessionShell() {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("session");
  const searchParams = useSearchParams();
  const presetParam = searchParams.get("preset");
  const minutesParam = searchParams.get("minutes");
  const subjectParam = searchParams.get("subject");
  const taskTitleParam = searchParams.get("taskTitle");
  const taskIdParam = searchParams.get("taskId");
  const sessionIdParam = searchParams.get("sessionId");
  /** Set by "bu masada çalış" on the room page — the seat this session will occupy. */
  const roomIdParam = searchParams.get("room");
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
  const [seatedRoom, setSeatedRoom] = useState<
    { id: string; name: string; theme: StudyRoomTheme; isOwner: boolean } | null
  >(null);
  const [themeBusy, setThemeBusy] = useState(false);
  /** Which way the ground travels on the next theme change — set by the arrow you pressed. */
  const [themeDirection, setThemeDirection] = useState<1 | -1>(1);

  const scene = useSyncExternalStore(
    subscribeSessionScene,
    getSessionScene,
    getServerSessionScene,
  );

  const [curtain, setCurtain] = useState(() => Boolean(roomIdParam));
  useEffect(() => {
    if (!roomIdParam) return;
    let active = true;
    getStudyRoom(roomIdParam)
      .then((room) => {
        if (active)
          setSeatedRoom({
            id: room.id,
            name: room.name,
            theme: room.theme,
            isOwner: room.role === "OWNER",
          });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [roomIdParam]);

  const roomTheme = seatedRoom?.id === roomIdParam ? (seatedRoom?.theme ?? null) : null;
  const activeTheme = roomTheme ?? scene.theme;
  const groundTheme = scene.plain ? null : activeTheme;

  const timer = useSessionTimer({
    initialMinutes: parseInitialMinutes(presetParam, minutesParam),
    initialBreakMinutes: parseInitialBreakMinutes(presetParam, minutesParam),
    initialPreset: parseInitialPreset(presetParam, minutesParam),
    subject,
    planTaskId: planTaskContext.taskId,
    planTaskTitle: planTaskContext.taskTitle,
    roomId: roomIdParam,
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

  const ambient = useSessionAmbientSound({
    phase,
    isPaused,
    suggestedTrackId: roomTheme ? STUDY_ROOM_AMBIENT[roomTheme] : null,
  });

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
      document.title = `${mm}:${ss} · ${label} · Mentor`;
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

  const changeRoomTheme = (next: StudyRoomTheme) => {
    if (!seatedRoom || themeBusy) return;
    setThemeBusy(true);
    updateStudyRoom(seatedRoom.id, { theme: next })
      .then((room) => setSeatedRoom((prev) => (prev ? { ...prev, theme: room.theme } : prev)))
      .catch(() => {})
      .finally(() => setThemeBusy(false));
  };

  const seated = seatedRoom && seatedRoom.id === roomIdParam ? seatedRoom : null;

  const renderTopBar = (readOnly = false) => (
    <SessionTopBar
      activeTheme={activeTheme}
      subject={subject}
      onSubjectChange={setSubject}
      readOnlySubject={readOnly}
      seatedRoom={seated}
      themeBusy={themeBusy}
      isPlain={scene.plain}
      onThemeChange={(next, direction) => {
        setThemeDirection(direction);
        if (seated) changeRoomTheme(next);
        else setSessionScene({ theme: next });
      }}
      onTogglePlain={() => setSessionScene({ plain: !scene.plain })}
      ambientTrackId={ambient.trackId}
      ambientMuted={ambient.muted}
      onAmbientTrackChange={ambient.setTrackId}
      onAmbientToggleMute={ambient.toggleMute}
    />
  );

  const phaseLabel =
    phase === "break"
      ? t("break_label")
      : isPaused
        ? t("paused")
        : t("focusing");

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
      <SessionFocusView
        groundTheme={groundTheme}
        themeDirection={themeDirection}
        topBar={renderTopBar(true)}
        planTaskChip={planTaskChip}
        phase={phase}
        phaseLabel={phaseLabel}
        timerRing={timerRing}
        sessionControls={sessionControls}
        phaseMotion={phaseMotion}
      />
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
      className="relative isolate flex w-full min-h-[calc(100dvh-4rem-80px-env(safe-area-inset-bottom))] flex-col lg:h-[100dvh] lg:min-h-0 lg:flex-row lg:overflow-hidden"
      aria-label={t("title")}
    >
      <h1 className="sr-only">{t("title")}</h1>
      {groundTheme ? (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <RoomBackdropSlide theme={groundTheme} direction={themeDirection} veilPercent={58} />
        </div>
      ) : null}
      {curtain && !reduceMotion ? (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-50"
          style={{ backgroundColor: "#000" }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: ROOM_CURTAIN_MS / 1000, ease: "easeOut" }}
          onAnimationComplete={() => setCurtain(false)}
        />
      ) : null}
      <HistorySideRail
        title={t("history_title")}
        railOpen={railOpen}
        onRailOpenChange={setRailOpen}
        expandLabel={t("history_open")}
        collapseLabel={t("history_collapse")}
        variant="liquid"
        testId="session-history-rail"
        collapsedActions={
          <button
            type="button"
            onClick={() => setRailOpen(true)}
            className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
            aria-label={t("history_title")}
            data-testid="session-history-rail-list"
          >
            <History
              className="size-5"
              style={{ color: "#ffffff" }}
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
        }
      >
        <SessionHistory variant="liquid" />
      </HistorySideRail>

      <div className="flex min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-y-auto">
        {/* Scenery & Settings bar: max-w-2xl allows the 3 pills to sit side-by-side in one row */}
        <div className="mx-auto flex w-full max-w-2xl justify-center px-4 pt-5 lg:px-6 lg:pt-6">
          {renderTopBar(false)}
        </div>
        <div className="flex items-center gap-2 px-5 pt-4 pb-1 lg:hidden">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full session-liquid-pill transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
            aria-label={t("history_open")}
            data-testid="session-history-open"
          >
            <PanelLeft
              className="size-5"
              style={{ color: "#ffffff" }}
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
              {planTaskChip}
              {timerRing}
              <SessionSetupSummary
                focusMinutes={focusMinutes}
                breakMinutes={breakMinutes}
                now={now}
              />
              {sessionControls}
              {focusingNow !== null ? (
                <p
                  className="flex items-center gap-1.5 text-center text-sm"
                  style={{ color: "rgba(255, 255, 255, 0.72)" }}
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
          borderColor: "rgba(255, 255, 255, 0.12)",
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
        <SessionRoomList />
        <SessionBuddyCard />
      </aside>

      <HistorySideDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        title={t("history_title")}
        variant="liquid"
        testId="session-history-drawer"
      >
        <SessionHistory variant="liquid" />
      </HistorySideDrawer>
    </main>
  );
}
