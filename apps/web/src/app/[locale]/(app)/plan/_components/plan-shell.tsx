"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import { useTranslations } from "next-intl";
import type { PlanTaskDto, PlanTaskStatus, TodayPanelResponse } from "@mentor/types";
import { ApiClientError, coachingControllerGetToday } from "@mentor/api-client";
import { useRouter } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { useStreakCelebration } from "@/components/streak-celebration";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import {
  createPlanTask,
  deletePlanTask,
  listPlanTasksForDate,
  listPlanTasksForMonthGrid,
  listPlanTasksForWeek,
  updatePlanTask,
} from "@/lib/plan-tasks";
import { monthGridDays } from "@/lib/plan-calendar-layout";
import { staggerItemVariants, staggerListVariants } from "@/lib/stagger-motion";
import { parsePlanAdaptationQuery } from "@/lib/plan-coach-adaptation-utils";
import { parseAnalysisPlanPrefill, type AnalysisPlanPrefill } from "@/lib/analysis-plan-prefill";
import { PlanAddTaskForm, type PlanAddTaskFormHandle } from "./plan-add-task-form";
import {
  PlanCoachAdaptationAction,
  type PlanCoachAdaptationActionHandle,
} from "./plan-coach-adaptation-action";
import { PlanCalendarView } from "./plan-calendar-view";
import { PlanDateNav } from "./plan-date-nav";
import { PlanDatePickerSheet, type PlanDatePickerSheetHandle } from "./plan-date-picker-sheet";
import { PlanEventDetails } from "./plan-event-details";
import { PlanListView } from "./plan-list-view";
import { PlanTimelineView } from "./plan-timeline-view";
import { PlanViewSwitcher } from "./plan-view-switcher";
import { PlanWeekNavButton } from "./plan-week-nav-button";
import {
  monthStart,
  persistCalendarScale,
  persistViewMode,
  readStoredCalendarScale,
  readStoredViewMode,
  shiftDate,
  shiftMonth,
  taskStats,
  todayIso,
  isPastDate,
  type PlanCalendarScale,
  type PlanViewMode,
  weekStart,
  weekDates,
} from "./plan-utils";

/** Best-effort human message from an unknown error (module-level so it's declared before use). */
function readError(err: unknown): string {
  return err instanceof ApiClientError
    ? err.message
    : err instanceof Error
      ? err.message
      : String(err);
}

function unwrapTodayResponse(response: unknown): TodayPanelResponse {
  return ((response as { data?: TodayPanelResponse }).data ?? response) as TodayPanelResponse;
}

/**
 * Plan page — three toggleable views (Liste / Timeline / Hafta) with shared CRUD.
 */
export function PlanShell() {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    filterSheet,
    show: showSheet,
    dismissNow: dismissSheetNow,
  } = useMentorBottomSheet();
  const { confirm } = useMentorDialog();
  const { error: showErrorToast } = useMentorToast();
  const { tryCelebrate, celebration } = useStreakCelebration();
  const streakBaselineRef = useRef<number | null>(null);

  const [viewMode, setViewMode] = useState<PlanViewMode>("list");
  const [calendarScale, setCalendarScale] = useState<PlanCalendarScale>("week");
  const [date, setDate] = useState(todayIso);
  const [weekAnchor, setWeekAnchor] = useState(() => weekStart(todayIso()));
  const [tasks, setTasks] = useState<PlanTaskDto[]>([]);
  const [weekTasks, setWeekTasks] = useState<Record<string, PlanTaskDto[]>>({});
  const [monthTasks, setMonthTasks] = useState<Record<string, PlanTaskDto[]>>({});
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [loadedWeek, setLoadedWeek] = useState<string | null>(null);
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const addFormRef = useRef<PlanAddTaskFormHandle>(null);
  const prefillConsumed = useRef(false);
  const prefill = useMemo(
    () =>
      parseAnalysisPlanPrefill({
        add: searchParams.get("add"),
        subject: searchParams.get("subject"),
        title: searchParams.get("title"),
      }),
    [searchParams],
  );
  const coachAdaptationRef = useRef<PlanCoachAdaptationActionHandle>(null);
  const adaptationConsumed = useRef(false);
  const adaptationRequest = useMemo(
    () =>
      parsePlanAdaptationQuery({
        coach: searchParams.get("coach"),
        source: searchParams.get("source"),
        sessionId: searchParams.get("sessionId"),
      }),
    [searchParams],
  );

  useEffect(() => {
    // Reads localStorage after mount (never on the server) so the stored view can't cause an SSR
    // hydration mismatch — a deliberate external-sync effect, not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewMode(readStoredViewMode());
    setCalendarScale(readStoredCalendarScale());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const today = unwrapTodayResponse(await coachingControllerGetToday());
        if (!cancelled) streakBaselineRef.current = today.streak.currentStreak;
      } catch {
        /* Streak celebration is best-effort. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const monthAnchor = monthStart(date);
  /**
   * The whole Takvim view reads from the month range, not just Ay: the 6×7 grid always contains
   * the selected date's full week, and the mobile agenda scrolls across the month. One request
   * feeds the strip, the hour grids, the month board and the agenda.
   */
  const showMonth = viewMode === "calendar";
  const dayLoading = loadedDate !== date;
  const weekLoading = loadedWeek !== weekAnchor;
  const monthLoading = loadedMonth !== monthAnchor;
  const readOnly = isPastDate(date);

  const loadDayTasks = useCallback(async (isMounted: () => boolean = () => true) => {
    try {
      const data = await listPlanTasksForDate(date);
      if (!isMounted()) return;
      setTasks(data);
      setLoadedDate(date);
      setError(null);
    } catch (err) {
      if (!isMounted()) return;
      setTasks([]);
      setLoadedDate(date);
      setError(readError(err));
    }
  }, [date]);

  const loadWeekTasks = useCallback(async (isMounted: () => boolean = () => true) => {
    try {
      const data = await listPlanTasksForWeek(weekAnchor);
      if (!isMounted()) return;
      setWeekTasks(data);
      setLoadedWeek(weekAnchor);
      setError(null);
    } catch (err) {
      if (!isMounted()) return;
      setWeekTasks({});
      setLoadedWeek(weekAnchor);
      setError(readError(err));
    }
  }, [weekAnchor]);
  const loadMonthTasks = useCallback(async (isMounted: () => boolean = () => true) => {
    const anchor = new Date(`${monthAnchor}T12:00:00`);
    try {
      const data = await listPlanTasksForMonthGrid(
        monthGridDays(anchor.getFullYear(), anchor.getMonth()),
      );
      if (!isMounted()) return;
      setMonthTasks(data);
      setLoadedMonth(monthAnchor);
      setError(null);
    } catch (err) {
      if (!isMounted()) return;
      setMonthTasks({});
      setLoadedMonth(monthAnchor);
      setError(readError(err));
    }
  }, [monthAnchor]);

  const refreshAdaptedPlan = useCallback(async () => {
    await Promise.all([loadDayTasks(), loadWeekTasks()]);
  }, [loadDayTasks, loadWeekTasks]);

  useEffect(() => {
    if (viewMode === "calendar") return;
    let active = true;
    // Loader state updates happen only after the awaited request; active guards unmounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDayTasks(() => active);
    return () => {
      active = false;
    };
  }, [date, viewMode, loadDayTasks]);

  // Ay ölçeği 42 günlük bir grid — haftalık yükleme yetmez.
  useEffect(() => {
    if (!showMonth) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMonthTasks(() => active);
    return () => {
      active = false;
    };
  }, [showMonth, loadMonthTasks]);

  // Week strip (all views) needs the current week’s tasks for day dots.
  useEffect(() => {
    let active = true;
    // Loader state updates happen only after the awaited request; active guards unmounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWeekTasks(() => active);
    return () => {
      active = false;
    };
  }, [weekAnchor, loadWeekTasks]);

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState !== "visible") return;
      void loadWeekTasks();
      if (viewMode !== "calendar") void loadDayTasks();
      if (showMonth) void loadMonthTasks();
    }
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) refreshIfVisible();
    }
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [viewMode, showMonth, loadDayTasks, loadWeekTasks, loadMonthTasks]);

  const activeTasks = useMemo(() => {
    if (viewMode === "calendar") return monthTasks[date] ?? [];
    if (viewMode === "timeline") return weekTasks[date] ?? [];
    return tasks;
  }, [monthTasks, viewMode, weekTasks, date, tasks]);

  function findTask(id: string): PlanTaskDto | undefined {
    const fromActive = activeTasks.find((x) => x.id === id);
    if (fromActive) return fromActive;
    const fromDay = tasks.find((x) => x.id === id);
    if (fromDay) return fromDay;
    for (const map of [weekTasks, monthTasks]) {
      for (const list of Object.values(map)) {
        const hit = list.find((x) => x.id === id);
        if (hit) return hit;
      }
    }
    return undefined;
  }

  const datePickerRef = useRef<PlanDatePickerSheetHandle>(null);

  const openCalendarSheet = useCallback(async () => {
    const seedPlannedDates = Object.entries(weekTasks)
      .filter(([, list]) => list.length > 0)
      .map(([iso]) => iso);

    await filterSheet({
      title: t("date_sheet_title"),
      applyLabel: t("date_sheet_apply"),
      children: (
        <PlanDatePickerSheet
          ref={datePickerRef}
          defaultValue={date}
          seedPlannedDates={seedPlannedDates}
        />
      ),
      onApply: () => {
        const picked = datePickerRef.current?.getValue() ?? date;
        setDate(picked);
        setWeekAnchor(weekStart(picked));
      },
    });
  }, [date, filterSheet, t, weekTasks]);

  function reportActionError(err: unknown) {
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
  }

  function handleViewChange(mode: PlanViewMode) {
    setViewMode(mode);
    persistViewMode(mode);
    setWeekAnchor(weekStart(date));
  }

  /** Apply `fn` to every day bucket of a date→tasks map (week and month share the shape). */
  function mapDayBuckets(
    map: Record<string, PlanTaskDto[]>,
    fn: (list: PlanTaskDto[]) => PlanTaskDto[],
  ): Record<string, PlanTaskDto[]> {
    const next = { ...map };
    for (const key of Object.keys(next)) next[key] = fn(next[key]!);
    return next;
  }

  function patchTaskLists(updated: PlanTaskDto) {
    const patch = (list: PlanTaskDto[]) =>
      list.map((x) => (x.id === updated.id ? updated : x));
    setTasks(patch);
    setWeekTasks((prev) => mapDayBuckets(prev, patch));
    setMonthTasks((prev) => mapDayBuckets(prev, patch));
  }

  function removeTaskFromLists(id: string) {
    const drop = (list: PlanTaskDto[]) => list.filter((x) => x.id !== id);
    setTasks(drop);
    setWeekTasks((prev) => mapDayBuckets(prev, drop));
    setMonthTasks((prev) => mapDayBuckets(prev, drop));
  }

  const appendTask = useCallback((created: PlanTaskDto) => {
    if (created.taskDate === date) {
      setTasks((prev) => [...prev, created]);
    }
    const add = (prev: Record<string, PlanTaskDto[]>) => {
      const day = created.taskDate;
      return { ...prev, [day]: [...(prev[day] ?? []), created] };
    };
    setWeekTasks(add);
    setMonthTasks(add);
  }, [date]);


  async function toggle(id: string) {
    const task = findTask(id);
    if (!task || busyId || isPastDate(task.taskDate)) return;
    const nextStatus: PlanTaskStatus = task.status === "DONE" ? "PENDING" : "DONE";
    const previousTasks = tasks;
    const previousWeek = weekTasks;
    const previousMonth = monthTasks;
    setError(null);
    const flip = (list: PlanTaskDto[]) =>
      list.map((x) => (x.id === id ? { ...x, status: nextStatus } : x));
    setTasks(flip);
    setWeekTasks((prev) => mapDayBuckets(prev, flip));
    setMonthTasks((prev) => mapDayBuckets(prev, flip));
    setBusyId(id);
    try {
      const updated = await updatePlanTask(id, { status: nextStatus });
      patchTaskLists(updated);
      if (nextStatus === "DONE" && updated.taskDate === todayIso()) {
        try {
          const previous = streakBaselineRef.current ?? 0;
          const today = unwrapTodayResponse(await coachingControllerGetToday());
          streakBaselineRef.current = today.streak.currentStreak;
          tryCelebrate(previous, today.streak.currentStreak);
        } catch {
          /* Celebration is best-effort. */
        }
      }
    } catch (err) {
      setTasks(previousTasks);
      setWeekTasks(previousWeek);
      setMonthTasks(previousMonth);
      reportActionError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    const task = findTask(id);
    if (!task || busyId || isPastDate(task.taskDate)) return;
    setBusyId(id);
    setError(null);
    const previousTasks = tasks;
    const previousWeek = weekTasks;
    const previousMonth = monthTasks;
    removeTaskFromLists(id);
    try {
      await deletePlanTask(id);
    } catch (err) {
      setTasks(previousTasks);
      setWeekTasks(previousWeek);
      setMonthTasks(previousMonth);
      reportActionError(err);
    } finally {
      setBusyId(null);
    }
  }

  const openEditSheet = useCallback(
    async (task: PlanTaskDto) => {
      if (busyId || isPastDate(task.taskDate)) return;
      await filterSheet({
        title: t("edit_sheet_title"),
        applyLabel: t("edit_task_save"),
        children: (
          <PlanAddTaskForm
            ref={addFormRef}
            initialTitle={task.title}
            initialSubject={task.subject ?? ""}
            initialStartTime={task.startTime}
            initialEndTime={task.endTime}
            initialDescription={task.description}
          />
        ),
        onApply: async () => {
          if (!addFormRef.current?.validate()) throw new Error("validation");
          const { title, subject, startTime, endTime, description } =
            addFormRef.current.getValues();
          const updated = await updatePlanTask(task.id, {
            title: title.trim(),
            subject: subject.trim() ? subject.trim() : null,
            // Times are always sent as a pair — that's the contract updatePlanTaskSchema enforces.
            startTime,
            endTime,
            description,
          });
          patchTaskLists(updated);
          setError(null);
        },
      });
    },
    [busyId, filterSheet, t],
  );

  async function confirmDeleteTask(task: PlanTaskDto) {
    if (busyId || isPastDate(task.taskDate)) return;
    const ok = await confirm({
      title: t("task_delete_confirm_title"),
      message: t("task_delete_confirm_message"),
      confirmLabel: t("task_delete_confirm_yes"),
      cancelLabel: t("task_delete_confirm_no"),
    });
    if (ok) await remove(task.id);
  }

  /** Tapping a calendar event opens its details; Düzenle / Sil hand off to the existing flows. */
  function openEventSheet(task: PlanTaskDto) {
    showSheet({
      title: t("event_details_title"),
      children: (
        <PlanEventDetails
          task={task}
          readOnly={isPastDate(task.taskDate)}
          onEdit={() => {
            dismissSheetNow();
            void openEditSheet(task);
          }}
          onDelete={() => {
            dismissSheetNow();
            void confirmDeleteTask(task);
          }}
        />
      ),
    });
  }

  /**
   * Calendar slot/day clicks pin the new item to that day (and hour); other entry points use the
   * currently selected date. There is only ONE form — `origin` picks the wording, because on a
   * calendar the same row reads as an "event" and in a list as a "task".
   */
  type PlanAddPrefill = Partial<AnalysisPlanPrefill> & {
    taskDate?: string;
    startTime?: string;
    origin?: "calendar";
  };

  const openAddSheet = useCallback(async (taskPrefill?: PlanAddPrefill | null) => {
    const targetDate = taskPrefill?.taskDate ?? date;
    if (isPastDate(targetDate)) return;
    await filterSheet({
      title:
        taskPrefill?.origin === "calendar"
          ? t("new_event_title")
          : t("add_sheet_title"),
      applyLabel: t("add_task"),
      children: (
        <PlanAddTaskForm
          ref={addFormRef}
          initialTitle={taskPrefill?.title}
          initialSubject={taskPrefill?.subject}
          initialStartTime={taskPrefill?.startTime ?? null}
        />
      ),
      onApply: async () => {
        if (!addFormRef.current?.validate()) throw new Error("validation");
        const { title, subject, startTime, endTime, description } =
          addFormRef.current.getValues();
        const created = await createPlanTask({
          title: title.trim(),
          taskDate: targetDate,
          ...(subject.trim() ? { subject: subject.trim() } : {}),
          ...(startTime ? { startTime, endTime } : {}),
          ...(description ? { description } : {}),
        });
        appendTask(created);
        setError(null);
      },
    });
  }, [appendTask, date, filterSheet, t]);

  useEffect(() => {
    if (!prefill || prefillConsumed.current || readOnly) return;
    prefillConsumed.current = true;
    void openAddSheet(prefill).finally(() => {
      router.replace("/plan");
    });
  }, [openAddSheet, prefill, readOnly, router]);

  useEffect(() => {
    if (!adaptationRequest || adaptationConsumed.current) return;
    adaptationConsumed.current = true;
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname,
    );
    coachAdaptationRef.current?.open(adaptationRequest);
  }, [adaptationRequest]);

  const dayProgress = taskStats(dayLoading ? [] : tasks);
  const weekDayProgress = taskStats(
    weekLoading ? [] : (weekTasks[date] ?? []),
  );
  const dateProgress =
    viewMode === "calendar" || viewMode === "timeline"
      ? weekDayProgress
      : dayProgress;

  /**
   * Remount key for the enter animation. Takvim deliberately keys on the SCALE ONLY: the mobile
   * agenda drives `date` from its own scroll position, so keying on the date (or the week/month
   * anchor it derives) would remount mid-scroll and throw the reader back where they started.
   * Date changes inside the calendar are plain re-renders.
   */
  const contentKey =
    viewMode === "calendar"
      ? `calendar-${calendarScale}`
      : viewMode === "timeline"
        ? `timeline-${weekAnchor}`
        : `${viewMode}-${date}`;

  function handleWeekChange(anchor: string) {
    setWeekAnchor(anchor);
    const days = weekDates(anchor);
    if (!days.includes(date)) {
      const today = todayIso();
      setDate(days.includes(today) ? today : anchor);
    }
  }

  function handleWeekDateChange(iso: string) {
    setDate(iso);
    setWeekAnchor(weekStart(iso));
  }

  function handleCalendarScaleChange(scale: PlanCalendarScale) {
    setCalendarScale(scale);
    persistCalendarScale(scale);
  }

  /** ‹ › steps one period at the active scale. */
  function handleCalendarStep(direction: -1 | 1) {
    if (calendarScale === "week") {
      handleWeekChange(shiftDate(weekAnchor, direction * 7));
      return;
    }
    handleWeekDateChange(
      calendarScale === "day"
        ? shiftDate(date, direction)
        : shiftMonth(date, direction),
    );
  }

  /**
   * Takvim runs full-bleed inside the app shell (everything but the sidebar). On desktop it is
   * also viewport-height with a `min-h-0` flex chain down to the hour grid, so the page itself
   * never scrolls — anything that appears above (the past-day notice) just shrinks the grid
   * instead of pushing the layout past the fold. Mobile keeps normal document scrolling.
   */
  const calendarFullScreen = viewMode === "calendar";
  const mainWidth = calendarFullScreen
    ? "w-full px-2 py-4 lg:flex lg:h-dvh lg:flex-col lg:px-6 lg:py-4"
    : "mx-auto w-full max-w-2xl px-5 py-6 lg:max-w-3xl lg:px-8 lg:py-10";

  const headerMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: "easeOut" as const },
        },
      };

  const gridMotion = reduceMotion
    ? {}
    : {
        initial: "hidden" as const,
        animate: "show" as const,
        variants: staggerListVariants,
      };

  return (
    <>
      <main className={mainWidth}>
        <motion.header
          className={`flex shrink-0 items-center gap-2 ${calendarFullScreen ? "mb-3" : "mb-5"}`}
          {...headerMotion}
        >
          <h1 className="sr-only">{t("title")}</h1>
          {/* Page-level exit from the full-screen calendar — it stands outside the calendar
              surface so it doesn't read as part of the month toolbar. */}
          {viewMode === "calendar" ? (
            <PlanWeekNavButton
              label={t("calendar_back")}
              onClick={() => handleViewChange("list")}
            >
              <ArrowLeft size={20} strokeWidth={2} aria-hidden />
            </PlanWeekNavButton>
          ) : null}
          <PlanCoachAdaptationAction
            ref={coachAdaptationRef}
            onApplied={refreshAdaptedPlan}
            onPlanChanged={refreshAdaptedPlan}
          />
        </motion.header>

        <motion.div
          className={`flex flex-col ${
            calendarFullScreen
              ? "gap-3 pb-4 lg:min-h-0 lg:flex-1 lg:pb-0"
              : "gap-5 pb-8"
          }`}
          {...gridMotion}
        >
          {/* Takvim is full-screen; the header back arrow replaces the switcher. */}
          {viewMode !== "calendar" ? (
            <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
              <PlanViewSwitcher value={viewMode} onChange={handleViewChange} />
            </motion.div>
          ) : null}

          <FormError message={error} />

          {/* Takvim carries its own date strip inside the calendar card. */}
          {viewMode !== "calendar" ? (
            <motion.div
              className="shrink-0"
              variants={reduceMotion ? undefined : staggerItemVariants}
            >
              <PlanDateNav
                date={date}
                weekStartDate={weekAnchor}
                weekTasks={weekTasks}
                progress={dateProgress.total > 0 ? dateProgress : undefined}
                onDateChange={handleWeekDateChange}
                onWeekChange={handleWeekChange}
                onOpenCalendar={() => void openCalendarSheet()}
              />
            </motion.div>
          ) : null}

          {readOnly ? (
            <motion.p
              className="w-fit max-w-full shrink-0 rounded-[var(--radius-card)] px-3 py-2 text-sm"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--color-progress-track) 35%, transparent)",
                color: "var(--color-body)",
                fontFamily: "var(--font-body)",
              }}
              variants={reduceMotion ? undefined : staggerItemVariants}
            >
              {t("past_readonly_notice")}
            </motion.p>
          ) : null}

          <motion.div
            key={contentKey}
            className={
              calendarFullScreen ? "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col" : undefined
            }
            initial={
              reduceMotion
                ? false
                : viewMode === "timeline"
                  ? { opacity: 0 }
                  : { opacity: 0, y: 6 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduceMotion
                ? undefined
                : {
                    duration: viewMode === "timeline" ? 0.18 : 0.22,
                    ease: "easeOut" as const,
                  }
            }
          >
            {viewMode === "list" ? (
              <PlanListView
                tasks={tasks}
                loading={dayLoading}
                busyId={busyId}
                readOnly={readOnly}
                onToggle={(id) => void toggle(id)}
                onEdit={(task) => void openEditSheet(task)}
                onDelete={(task) => void confirmDeleteTask(task)}
                onAddTask={() => void openAddSheet()}
              />
            ) : null}
            {viewMode === "timeline" ? (
              <PlanTimelineView
                weekStartDate={weekAnchor}
                weekTasks={weekTasks}
                selectedDate={date}
                loading={weekLoading}
                busyId={busyId}
                onDateChange={handleWeekDateChange}
                onToggle={(id) => void toggle(id)}
                onEdit={(task) => void openEditSheet(task)}
                onDelete={(task) => void confirmDeleteTask(task)}
                onAddTask={() => void openAddSheet()}
              />
            ) : null}
            {viewMode === "calendar" ? (
              <PlanCalendarView
                scale={calendarScale}
                selectedDate={date}
                weekStartDate={weekAnchor}
                tasksByDate={monthTasks}
                loading={monthLoading}
                busyId={busyId}
                readOnly={readOnly}
                onScaleChange={handleCalendarScaleChange}
                onStep={handleCalendarStep}
                onToday={() => handleWeekDateChange(todayIso())}
                onDateChange={handleWeekDateChange}
                onToggle={(id) => void toggle(id)}
                onEdit={(task) => void openEditSheet(task)}
                onDelete={(task) => void confirmDeleteTask(task)}
                onOpenEvent={openEventSheet}
                onAddTask={(addPrefill) => void openAddSheet(addPrefill)}
              />
            ) : null}
          </motion.div>
        </motion.div>
      </main>
      {celebration}
    </>
  );
}
