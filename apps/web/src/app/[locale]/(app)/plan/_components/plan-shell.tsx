"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
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
  listPlanTasksForWeek,
  updatePlanTask,
} from "@/lib/plan-tasks";
import { staggerItemVariants, staggerListVariants } from "@/lib/stagger-motion";
import { parsePlanAdaptationQuery } from "@/lib/plan-coach-adaptation-utils";
import { parseAnalysisPlanPrefill, type AnalysisPlanPrefill } from "@/lib/analysis-plan-prefill";
import { PlanAddTaskForm, type PlanAddTaskFormHandle } from "./plan-add-task-form";
import {
  PlanCoachAdaptationAction,
  type PlanCoachAdaptationActionHandle,
} from "./plan-coach-adaptation-action";
import { PlanDateNav } from "./plan-date-nav";
import { PlanDatePickerSheet, type PlanDatePickerSheetHandle } from "./plan-date-picker-sheet";
import { PlanListView } from "./plan-list-view";
import { PlanTimelineView } from "./plan-timeline-view";
import { PlanViewSwitcher } from "./plan-view-switcher";
import { PlanWeekDesktopLayout } from "./plan-week-desktop-layout";
import { PlanWeekNavCard } from "./plan-week-nav-card";
import { PlanWeekView } from "./plan-week-view";
import {
  persistViewMode,
  readStoredViewMode,
  taskStats,
  todayIso,
  isPastDate,
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
  const { filterSheet } = useMentorBottomSheet();
  const { confirm } = useMentorDialog();
  const { error: showErrorToast } = useMentorToast();
  const { tryCelebrate, celebration } = useStreakCelebration();
  const streakBaselineRef = useRef<number | null>(null);

  const [viewMode, setViewMode] = useState<PlanViewMode>("list");
  const [date, setDate] = useState(todayIso);
  const [weekAnchor, setWeekAnchor] = useState(() => weekStart(todayIso()));
  const [tasks, setTasks] = useState<PlanTaskDto[]>([]);
  const [weekTasks, setWeekTasks] = useState<Record<string, PlanTaskDto[]>>({});
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [loadedWeek, setLoadedWeek] = useState<string | null>(null);
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

  const dayLoading = loadedDate !== date;
  const weekLoading = loadedWeek !== weekAnchor;
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
  const refreshAdaptedPlan = useCallback(async () => {
    await Promise.all([loadDayTasks(), loadWeekTasks()]);
  }, [loadDayTasks, loadWeekTasks]);

  useEffect(() => {
    if (viewMode === "week") return;
    let active = true;
    // Loader state updates happen only after the awaited request; active guards unmounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDayTasks(() => active);
    return () => {
      active = false;
    };
  }, [date, viewMode, loadDayTasks]);

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
      if (viewMode !== "week") void loadDayTasks();
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
  }, [viewMode, loadDayTasks, loadWeekTasks]);

  const activeTasks = useMemo(() => {
    if (viewMode === "week" || viewMode === "timeline") {
      return weekTasks[date] ?? [];
    }
    return tasks;
  }, [viewMode, weekTasks, date, tasks]);

  function findTask(id: string): PlanTaskDto | undefined {
    const fromActive = activeTasks.find((x) => x.id === id);
    if (fromActive) return fromActive;
    const fromDay = tasks.find((x) => x.id === id);
    if (fromDay) return fromDay;
    for (const list of Object.values(weekTasks)) {
      const hit = list.find((x) => x.id === id);
      if (hit) return hit;
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

  function patchTaskLists(updated: PlanTaskDto) {
    setTasks((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setWeekTasks((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key]!.map((x) => (x.id === updated.id ? updated : x));
      }
      return next;
    });
  }

  function removeTaskFromLists(id: string) {
    setTasks((prev) => prev.filter((x) => x.id !== id));
    setWeekTasks((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key]!.filter((x) => x.id !== id);
      }
      return next;
    });
  }

  const appendTask = useCallback((created: PlanTaskDto) => {
    if (created.taskDate === date) {
      setTasks((prev) => [...prev, created]);
    }
    setWeekTasks((prev) => {
      const day = created.taskDate;
      const list = prev[day] ?? [];
      return { ...prev, [day]: [...list, created] };
    });
  }, [date]);


  async function toggle(id: string) {
    const task = findTask(id);
    if (!task || busyId || isPastDate(task.taskDate)) return;
    const nextStatus: PlanTaskStatus = task.status === "DONE" ? "PENDING" : "DONE";
    const previousTasks = tasks;
    const previousWeek = weekTasks;
    setError(null);
    setTasks((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: nextStatus } : x)),
    );
    setWeekTasks((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key]!.map((x) =>
          x.id === id ? { ...x, status: nextStatus } : x,
        );
      }
      return next;
    });
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
    removeTaskFromLists(id);
    try {
      await deletePlanTask(id);
    } catch (err) {
      setTasks(previousTasks);
      setWeekTasks(previousWeek);
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
          />
        ),
        onApply: async () => {
          if (!addFormRef.current?.validate()) throw new Error("validation");
          const { title, subject } = addFormRef.current.getValues();
          const updated = await updatePlanTask(task.id, {
            title: title.trim(),
            subject: subject.trim() ? subject.trim() : null,
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

  const openAddSheet = useCallback(async (taskPrefill?: AnalysisPlanPrefill | null) => {
    if (readOnly) return;
    await filterSheet({
      title: t("add_sheet_title"),
      applyLabel: t("add_task"),
      children: (
        <PlanAddTaskForm
          ref={addFormRef}
          initialTitle={taskPrefill?.title}
          initialSubject={taskPrefill?.subject}
        />
      ),
      onApply: async () => {
        if (!addFormRef.current?.validate()) throw new Error("validation");
        const { title, subject } = addFormRef.current.getValues();
        const created = await createPlanTask({
          title: title.trim(),
          taskDate: date,
          ...(subject.trim() ? { subject: subject.trim() } : {}),
        });
        appendTask(created);
        setError(null);
      },
    });
  }, [appendTask, date, filterSheet, readOnly, t]);

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
    viewMode === "week" || viewMode === "timeline"
      ? weekDayProgress
      : dayProgress;

  const contentKey =
    viewMode === "week"
      ? `week-${weekAnchor}-${date}`
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

  const mainMaxWidth =
    viewMode === "week" ? "lg:max-w-6xl" : "lg:max-w-3xl";

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
      <main
        className={`mx-auto w-full max-w-2xl px-5 py-6 lg:px-8 lg:py-10 ${mainMaxWidth}`}
      >
        <motion.header className="mb-5" {...headerMotion}>
          <h1 className="sr-only">{t("title")}</h1>
          <PlanCoachAdaptationAction
            ref={coachAdaptationRef}
            onApplied={refreshAdaptedPlan}
            onPlanChanged={refreshAdaptedPlan}
          />
        </motion.header>

        <motion.div className="flex flex-col gap-5 pb-8" {...gridMotion}>
          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <PlanViewSwitcher value={viewMode} onChange={handleViewChange} />
          </motion.div>

          <FormError message={error} />

          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            {viewMode !== "week" ? (
              <PlanDateNav
                date={date}
                weekStartDate={weekAnchor}
                weekTasks={weekTasks}
                progress={
                  dateProgress.total > 0 ? dateProgress : undefined
                }
                onDateChange={handleWeekDateChange}
                onWeekChange={handleWeekChange}
                onOpenCalendar={() => void openCalendarSheet()}
              />
            ) : (
              <PlanWeekNavCard
                weekStartDate={weekAnchor}
                selectedDate={date}
                weekTasks={weekTasks}
                onWeekChange={handleWeekChange}
                onDateChange={handleWeekDateChange}
              />
            )}
          </motion.div>

          {readOnly ? (
            <motion.p
              className="rounded-[var(--radius-card)] px-3 py-2.5 text-sm"
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
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduceMotion
                ? undefined
                : { duration: 0.22, ease: "easeOut" as const }
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
            {viewMode === "week" ? (
              <>
                <PlanWeekDesktopLayout
                  selectedDate={date}
                  weekStartDate={weekAnchor}
                  weekTasks={weekTasks}
                  loading={weekLoading}
                  busyId={busyId}
                  readOnly={readOnly}
                  onDateChange={handleWeekDateChange}
                  onWeekChange={handleWeekChange}
                  onToggle={(id) => void toggle(id)}
                  onEdit={(task) => void openEditSheet(task)}
                  onDelete={(task) => void confirmDeleteTask(task)}
                  onAddTask={() => void openAddSheet()}
                />
                <PlanWeekView
                  selectedDate={date}
                  weekTasks={weekTasks}
                  loading={weekLoading}
                  busyId={busyId}
                  readOnly={readOnly}
                  onToggle={(id) => void toggle(id)}
                  onEdit={(task) => void openEditSheet(task)}
                  onDelete={(task) => void confirmDeleteTask(task)}
                  onAddTask={() => void openAddSheet()}
                />
              </>
            ) : null}
          </motion.div>
        </motion.div>
      </main>
      {celebration}
    </>
  );
}
