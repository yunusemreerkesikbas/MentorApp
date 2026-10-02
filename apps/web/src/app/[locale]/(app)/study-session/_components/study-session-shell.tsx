"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type {
  FocusGoalDto,
  QuestProgressView,
  SessionPresetDto,
  StudyRoomTheme,
} from "@mentor/types";
import { ApiClientError, coachingControllerGetToday } from "@mentor/api-client";
import { CompletionOverlay } from "@mentor/ui";
import { HistorySideDrawer } from "@/components/history-side-panel";
import { fetchQuests, isEconomyDisabled } from "@/lib/economy";
import { trackCoachEvent } from "@/lib/analytics";
import { parsePlanTaskContextFromParams } from "@/lib/plan-study-session-link";
import { getStudyRoom, updateStudyRoom } from "@/lib/study-rooms";
import { STUDY_ROOM_AMBIENT } from "@/lib/study-room-theme";
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
import { SessionHistory } from "./session-history";
import { SessionIdleView } from "./session-idle-view";
import { SessionRoomList } from "./session-room-list";
import { SessionStage } from "./session-stage";
import { measureIdleRing, SessionTimerRing, type RingCenter } from "./session-timer-ring";
import { SessionTodayCard } from "./session-today-card";
import { useSessionAmbientSound } from "./use-session-ambient-sound";
import { useSessionTimer } from "./use-session-timer";

/**
 * Pomodoro session UI — setup dial (idle), immersive focus/break, done summary.
 */
export function StudySessionShell() {
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
  /** `undefined` while `/coaching/today` loads, `null` if it failed (the "Bugün" card hides). */
  const [focusGoal, setFocusGoal] = useState<FocusGoalDto | null | undefined>(undefined);
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
  const [seatedRoom, setSeatedRoom] = useState<
    { id: string; name: string; theme: StudyRoomTheme; isOwner: boolean } | null
  >(null);
  const [themeBusy, setThemeBusy] = useState(false);
  /** Which way the ground travels on the next theme change — set by the arrow you pressed. */
  const [themeDirection, setThemeDirection] = useState<1 | -1>(1);
  /** Where the setup ring stood when Start was pressed; the running ring flies in from there. */
  const [ringFrom, setRingFrom] = useState<RingCenter | null>(null);
  /** The session just finished, so the Bugün card can grow it into the day's strip. */
  const [freshSessionId, setFreshSessionId] = useState<string | null>(null);

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
        setFocusGoal(data.focusGoal ?? null);
        setFocusingNow(data.focusingNow ?? null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setPresets(DEFAULT_PRESETS);
        setFocusGoal((goal) => goal ?? null);
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
    isStopwatch,
    selectStopwatch,
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
      const displaySeconds = isStopwatch ? focusElapsed : secondsLeft;
      const mm = String(Math.floor(displaySeconds / 60)).padStart(2, "0");
      const ss = String(displaySeconds % 60).padStart(2, "0");
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
  }, [phase, secondsLeft, isStopwatch, focusElapsed, isPaused, t]);
  useEffect(
    () => () => {
      if (initialTitleRef.current) document.title = initialTitleRef.current;
    },
    [],
  );

  const handleStartSession = async () => {
    setRingFrom(measureIdleRing());
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
    setFreshSessionId(session?.id ?? null);
    setRingFrom(null);
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
      isStopwatch={isStopwatch}
      focusElapsed={focusElapsed}
      onStopwatchSelect={() => { selectStopwatch(); setSelectedPresetId("stopwatch"); }}
      presets={presets}
      selectedPresetId={selectedPresetId}
      onMinutesChange={handleMinutesChange}
      onPresetSelect={handlePresetSelect}
      flyFrom={phase === "focus" || phase === "break" ? ringFrom : null}
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

  const renderIdle = () => (
    <SessionIdleView
      key="idle"
      groundTheme={groundTheme}
      curtain={curtain}
      onCurtainDone={() => setCurtain(false)}
      topBar={renderTopBar(false)}
      timer={
        <>
          {presetNotice ? (
            <p role="status" className="text-center text-body-sm font-semibold text-[var(--color-secondary)]">
              {presetNotice}
            </p>
          ) : null}
          {planTaskChip}
          {timerRing}
          <SessionSetupSummary isStopwatch={isStopwatch} focusMinutes={focusMinutes} breakMinutes={breakMinutes} now={now} />
          {sessionControls}
          {focusingNow !== null ? (
            <p className="flex items-center gap-1.5 text-center text-body-sm font-semibold text-[var(--color-secondary)]">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--play-cta)]" />
              {t("focusing_now", { count: focusingNow })}
            </p>
          ) : null}
        </>
      }
      rail={
        <>
          <SessionTodayCard
            focusGoal={focusGoal}
            freshSessionId={freshSessionId}
            onGoalChange={(goalMinutes) =>
              setFocusGoal((g) => ({
                goalMinutes,
                focusMinutesToday: g?.focusMinutesToday ?? 0,
              }))
            }
            onOpenHistory={() => setHistoryOpen(true)}
          />
          <SessionRoomList />
          <SessionBuddyCard />
        </>
      }
      drawer={
        <HistorySideDrawer
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          title={t("history_title")}
          side="right"
          desktop
          testId="session-history-drawer"
        >
          <SessionHistory variant="default" />
        </HistorySideDrawer>
      }
    />
  );

  return (
    <SessionStage phase={phase} groundTheme={groundTheme} themeDirection={themeDirection}>
      {/* `initial={false}`: the first paint stands still; only a return from a session animates. */}
      <AnimatePresence initial={false}>
        {phase === "idle" ? renderIdle() : null}
      </AnimatePresence>
      {phase === "focus" || phase === "break" ? (
        <SessionFocusView
          groundTheme={groundTheme}
          topBar={renderTopBar(true)}
          planTaskChip={planTaskChip}
          phaseLabel={phaseLabel}
          timerRing={timerRing}
          sessionControls={sessionControls}
        />
      ) : null}
      {phase === "done" ? (
        <CompletionOverlay open label={t("done_title")}>
          <SessionDoneState
            focusElapsed={focusElapsed}
            plannedMinutes={isStopwatch ? focusElapsed / 60 : focusMinutes}
            sessionId={session?.id ?? null}
            subject={subject}
            planTaskTitle={planTaskContext.taskTitle}
            focusGoal={focusGoal ?? null}
            questBaseline={questBaseline}
            streakBaseline={streakBaseline}
            countsAsFocusSession={session?.countsAsFocusSession ?? true}
            sessionStatus={session?.status ?? null}
            planTaskAutoCompleted={session?.planTaskAutoCompleted ?? false}
            onSubmitFeedback={recordFeedback}
            onReset={handleReset}
          />
        </CompletionOverlay>
      ) : null}
    </SessionStage>
  );
}
