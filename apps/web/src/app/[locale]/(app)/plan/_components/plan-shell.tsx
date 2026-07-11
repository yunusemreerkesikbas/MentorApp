"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import type { PlanTaskDto, PlanTaskStatus } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import Plus from "lucide-react/dist/esm/icons/plus.mjs";
import { Link, useRouter } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { MOBILE_TAB_BAR_STICKY_BOTTOM_CLASS } from "@/lib/app-shell";
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
import { parseAnalysisPlanPrefill, type AnalysisPlanPrefill } from "@/lib/analysis-plan-prefill";
import { PlanAddTaskForm, type PlanAddTaskFormHandle } from "./plan-add-task-form";
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
  formatWeekdayShort,
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

/**
 * Plan page — three toggleable views (Liste / Timeline / Hafta) with shared CRUD.
 */
export function PlanShell() {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { filterSheet, actionSheet } = useMentorBottomSheet();
  const { confirm } = useMentorDialog();
  const { error: showErrorToast } = useMentorToast();

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

  useEffect(() => {
    // Reads localStorage after mount (never on the server) so the stored view can't cause an SSR
    // hydration mismatch — a deliberate external-sync effect, not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewMode(readStoredViewMode());
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

  useEffect(() => {
    if (viewMode === "week") return;
    let active = true;
    void loadDayTasks(() => active);
    return () => {
      active = false;
    };
  }, [date, viewMode, loadDayTasks]);

  useEffect(() => {
    if (viewMode !== "week") return;
    let active = true;
    void loadWeekTasks(() => active);
    return () => {
      active = false;
    };
  }, [viewMode, weekAnchor, loadWeekTasks]);

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState !== "visible") return;
      if (viewMode === "week") void loadWeekTasks();
      else void loadDayTasks();
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
    if (viewMode === "week") return weekTasks[date] ?? [];
    return tasks;
  }, [viewMode, weekTasks, date, tasks]);

  const datePickerRef = useRef<PlanDatePickerSheetHandle>(null);

  const openCalendarSheet = useCallback(async () => {
    const seedPlannedDates =
      viewMode === "week"
        ? Object.entries(weekTasks)
            .filter(([, list]) => list.length > 0)
            .map(([iso]) => iso)
        : tasks.length > 0
          ? [date]
          : [];

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
        if (viewMode === "week") setWeekAnchor(weekStart(picked));
      },
    });
  }, [date, filterSheet, t, tasks, viewMode, weekTasks]);

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
    if (mode === "week") {
      setWeekAnchor(weekStart(date));
    }
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

  function appendTask(created: PlanTaskDto) {
    if (created.taskDate === date) {
      setTasks((prev) => [...prev, created]);
    }
    setWeekTasks((prev) => {
      const day = created.taskDate;
      const list = prev[day] ?? [];
      return { ...prev, [day]: [...list, created] };
    });
  }

  async function toggle(id: string) {
    if (readOnly) return;
    const task = activeTasks.find((x) => x.id === id) ?? tasks.find((x) => x.id === id);
    if (!task || busyId) return;
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
    } catch (err) {
      setTasks(previousTasks);
      setWeekTasks(previousWeek);
      reportActionError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (readOnly) return;
    if (busyId) return;
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

  async function openTaskMenu(task: PlanTaskDto) {
    if (readOnly || busyId) return;
    const isDone = task.status === "DONE";
    const result = await actionSheet({
      title: t("task_sheet_title"),
      actions: [
        {
          id: isDone ? "toggle_pending" : "toggle_done",
          label: isDone
            ? t("task_action_toggle_pending")
            : t("task_action_toggle_done"),
          icon: "check-circle",
        },
        {
          id: "delete",
          label: t("task_action_delete"),
          icon: "delete",
          destructive: true,
          showChevron: false,
        },
      ],
    });
    if (result === "cancel") return;
    if (result === "toggle_done" || result === "toggle_pending") {
      await toggle(task.id);
      return;
    }
    if (result === "delete") {
      const ok = await confirm({
        title: t("task_delete_confirm_title"),
        message: t("task_delete_confirm_message"),
        confirmLabel: t("task_delete_confirm_yes"),
        cancelLabel: t("task_delete_confirm_no"),
      });
      if (ok) await remove(task.id);
    }
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
  }, [date, filterSheet, readOnly, t]);

  useEffect(() => {
    if (!prefill || prefillConsumed.current || readOnly) return;
    prefillConsumed.current = true;
    void openAddSheet(prefill).finally(() => {
      router.replace("/plan");
    });
  }, [openAddSheet, prefill, readOnly, router]);

  const dayProgress = taskStats(dayLoading ? [] : tasks);
  const weekDayProgress = taskStats(
    weekLoading ? [] : (weekTasks[date] ?? []),
  );
  const dateProgress =
    viewMode === "week"
      ? weekDayProgress
      : dayProgress;

  const contentKey =
    viewMode === "week" ? `week-${weekAnchor}-${date}` : `${viewMode}-${date}`;

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

  const weekAddCaption = useMemo(
    () =>
      t("week_add_caption", {
        weekday: formatWeekdayShort(date, locale),
      }),
    [date, locale, t],
  );

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
          <h1
            className="text-[28px] font-bold lg:text-[32px]"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {t("title")}
          </h1>
          <p
            className="mt-1 text-base"
            style={{ color: "var(--color-secondary)" }}
          >
            {t("subtitle")}
          </p>
        </motion.header>

        <motion.div className="flex flex-col gap-5 pb-28 lg:pb-8" {...gridMotion}>
          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <PlanViewSwitcher value={viewMode} onChange={handleViewChange} />
          </motion.div>

          <FormError message={error} />

          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            {viewMode !== "week" ? (
              <PlanDateNav
                date={date}
                progress={
                  dateProgress.total > 0 ? dateProgress : undefined
                }
                onDateChange={setDate}
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
                onMenu={(task) => void openTaskMenu(task)}
              />
            ) : null}
            {viewMode === "timeline" ? (
              <PlanTimelineView
                date={date}
                tasks={tasks}
                loading={dayLoading}
                busyId={busyId}
                readOnly={readOnly}
                onMenu={(task) => void openTaskMenu(task)}
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
                  onMenu={(task) => void openTaskMenu(task)}
                  onAddTask={() => void openAddSheet()}
                />
                <PlanWeekView
                  selectedDate={date}
                  weekTasks={weekTasks}
                  loading={weekLoading}
                  busyId={busyId}
                  readOnly={readOnly}
                  onToggle={(id) => void toggle(id)}
                  onMenu={(task) => void openTaskMenu(task)}
                />
              </>
            ) : null}
          </motion.div>

          {!readOnly && viewMode !== "week" ? (
            <motion.div
              className="hidden lg:block"
              variants={reduceMotion ? undefined : staggerItemVariants}
            >
              <Button type="button" onClick={() => void openAddSheet()} className="min-w-[200px]">
                <Plus size={18} strokeWidth={2.5} aria-hidden />
                {t("add_task")}
              </Button>
            </motion.div>
          ) : null}

          <motion.div
            className="lg:hidden"
            variants={reduceMotion ? undefined : staggerItemVariants}
          >
            <Link
              href="/panel"
              className="flex min-h-11 items-center justify-center text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
              style={{
                color: "var(--color-main)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {t("back_panel")}
            </Link>
          </motion.div>
        </motion.div>
      </main>

      {!readOnly ? (
        <div
          className={`fixed left-0 right-0 z-30 mx-auto w-full max-w-2xl px-5 lg:hidden ${MOBILE_TAB_BAR_STICKY_BOTTOM_CLASS}`}
        >
          {viewMode === "week" ? (
            <p
              className="mb-1.5 text-center text-xs"
              style={{ color: "var(--color-secondary)" }}
            >
              {weekAddCaption}
            </p>
          ) : null}
          <Button type="button" fullWidth onClick={() => void openAddSheet()}>
            <Plus size={18} strokeWidth={2.5} aria-hidden />
            {t("add_task")}
          </Button>
        </div>
      ) : null}
    </>
  );
}
