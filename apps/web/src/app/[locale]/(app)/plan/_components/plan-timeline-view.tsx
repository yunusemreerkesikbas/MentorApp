"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { PlanTaskDto } from "@mentor/types";
import { Card } from "@mentor/ui";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { PlanAddTaskButton } from "./plan-add-task-button";
import { PlanTimelineSkeleton } from "./plan-content-skeleton";
import { PlanTaskRow } from "./plan-task-row";
import {
  formatDateLabel,
  formatMonthDayShort,
  isPastDate,
  planTimelineDayId,
  taskStats,
  todayIso,
  weekDates,
} from "./plan-utils";

/** Keep a day header visible at the top when scrolled to the end. */
const END_SPACER_RESERVE_PX = 72;
/** Day-to-day scroll settle duration (ease-out cubic). */
const SCROLL_ANIM_MS = 420;

function animateScrollerTo(
  scroller: HTMLElement,
  targetTop: number,
  durationMs: number,
) {
  const startTop = scroller.scrollTop;
  const delta = targetTop - startTop;
  if (Math.abs(delta) < 1) {
    scroller.scrollTop = targetTop;
    return;
  }

  const previousBehavior = scroller.style.scrollBehavior;
  scroller.style.scrollBehavior = "auto";
  const t0 = performance.now();

  const tick = (now: number) => {
    const t = Math.min(1, (now - t0) / durationMs);
    const eased = 1 - (1 - t) ** 3;
    scroller.scrollTop = startTop + delta * eased;
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      scroller.style.scrollBehavior = previousBehavior;
    }
  };

  requestAnimationFrame(tick);
}

export function PlanTimelineView({
  weekStartDate,
  weekTasks,
  selectedDate,
  loading,
  busyId,
  onDateChange,
  onToggle,
  onEdit,
  onDelete,
  onAddTask,
  completionPromptTaskId,
  onDismissCompletionPrompt,
}: {
  weekStartDate: string;
  weekTasks: Record<string, PlanTaskDto[]>;
  selectedDate: string;
  loading: boolean;
  busyId: string | null;
  onDateChange?: (iso: string) => void;
  onToggle: (id: string) => void;
  onEdit: (task: PlanTaskDto) => void;
  onDelete: (task: PlanTaskDto) => void;
  onAddTask?: () => void;
  completionPromptTaskId?: string | null;
  onDismissCompletionPrompt?: () => void;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const days = weekDates(weekStartDate);
  const selectedPast = isPastDate(selectedDate);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const ignoreScrollSyncRef = useRef(false);
  const ignoreClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastEmittedDateRef = useRef(selectedDate);
  const pendingAlignRef = useRef<string | null>(null);
  const alignedWeekRef = useRef<string | null>(null);
  const activeIsoRef = useRef(selectedDate);

  const [activeIso, setActiveIso] = useState(selectedDate);
  const [fillRatio, setFillRatio] = useState(0);
  const [endSpacerPx, setEndSpacerPx] = useState(0);
  /** False until scroll is pinned to today — avoids Liste→Timeline jump. */
  const [viewportReady, setViewportReady] = useState(false);

  // Mirror of `activeIso` for scroll handlers. Written after commit — refs must not be touched
  // during render; handlers only run post-commit, so they never read a stale value.
  useEffect(() => {
    activeIsoRef.current = activeIso;
  }, [activeIso]);

  const dayOffsetTop = useCallback((iso: string) => {
    const el = document.getElementById(planTimelineDayId(iso));
    return el?.offsetTop ?? 0;
  }, []);

  const scrollToDay = useCallback(
    (iso: string, behavior: ScrollBehavior) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;

      ignoreScrollSyncRef.current = true;
      if (ignoreClearTimerRef.current) clearTimeout(ignoreClearTimerRef.current);

      const top = Math.max(0, dayOffsetTop(iso));
      if (behavior === "smooth") {
        animateScrollerTo(scroller, top, SCROLL_ANIM_MS);
      } else {
        scroller.scrollTo({ top, behavior: "auto" });
      }

      ignoreClearTimerRef.current = setTimeout(
        () => {
          ignoreScrollSyncRef.current = false;
        },
        behavior === "smooth" ? SCROLL_ANIM_MS : 80,
      );
    },
    [dayOffsetTop],
  );

  const syncFromScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    const rail = railRef.current;
    if (!scroller || !rail || days.length === 0) return;

    const scrollTop = scroller.scrollTop;
    let active = days[0]!;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const iso of days) {
      const section = document.getElementById(planTimelineDayId(iso));
      if (!section) continue;
      const dist = Math.abs(section.offsetTop - scrollTop);
      if (dist < bestDist) {
        bestDist = dist;
        active = iso;
      }
    }

    const activeEl = document.getElementById(planTimelineDayId(active));
    const fillPx = (activeEl?.offsetTop ?? 0) + 22;
    const railHeight = Math.max(rail.offsetHeight, 1);
    const ratio = Math.min(1, Math.max(0, fillPx / railHeight));
    setFillRatio(ratio);
    setActiveIso((prev) => (prev === active ? prev : active));
    activeIsoRef.current = active;

    if (pendingAlignRef.current) return;

    if (
      !ignoreScrollSyncRef.current &&
      active !== lastEmittedDateRef.current
    ) {
      lastEmittedDateRef.current = active;
      onDateChange?.(active);
    }
  }, [days, onDateChange]);

  // Pin spacer + scroll to today in one layout pass (before paint) so tab switches don't jump.
  useLayoutEffect(() => {
    if (loading) return;
    const scroller = scrollerRef.current;
    const spacerEl = spacerRef.current;
    if (!scroller || !spacerEl) return;

    const applySpacer = () => {
      const next = Math.max(0, scroller.clientHeight - END_SPACER_RESERVE_PX);
      spacerEl.style.height = `${next}px`;
      setEndSpacerPx((prev) => (prev === next ? prev : next));
      return next;
    };

    applySpacer();

    const needsPin = alignedWeekRef.current !== weekStartDate;
    if (needsPin) {
      const today = todayIso();
      const target = days.includes(today) ? today : selectedDate;
      const dayEl = document.getElementById(planTimelineDayId(target));

      ignoreScrollSyncRef.current = true;
      scroller.style.scrollBehavior = "auto";
      if (dayEl) {
        scroller.scrollTop = dayEl.offsetTop;
      }

      alignedWeekRef.current = weekStartDate;
      lastEmittedDateRef.current = target;
      activeIsoRef.current = target;
      setActiveIso(target);

      if (target !== selectedDate) {
        pendingAlignRef.current = target;
        onDateChange?.(target);
      } else {
        pendingAlignRef.current = null;
      }

      syncFromScroll();
      requestAnimationFrame(() => {
        ignoreScrollSyncRef.current = false;
      });
    }

    // Reveal only after the scroll is pinned — the flip happens in the layout pass, before paint,
    // so the timeline never renders unpinned (the Liste→Timeline jump this guards against).
    setViewportReady(true);

    const ro = new ResizeObserver(() => {
      applySpacer();
      syncFromScroll();
    });
    ro.observe(scroller);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- week-entry pin only
  }, [loading, weekStartDate]);

  useEffect(() => {
    if (loading) return;

    if (pendingAlignRef.current) {
      if (selectedDate === pendingAlignRef.current) {
        pendingAlignRef.current = null;
        lastEmittedDateRef.current = selectedDate;
        activeIsoRef.current = selectedDate;
        setActiveIso(selectedDate);
        scrollToDay(selectedDate, "auto");
        requestAnimationFrame(() => syncFromScroll());
      }
      return;
    }

    if (selectedDate === lastEmittedDateRef.current) return;
    lastEmittedDateRef.current = selectedDate;
    activeIsoRef.current = selectedDate;
    setActiveIso(selectedDate);
    const behavior: ScrollBehavior = reduceMotion ? "auto" : "smooth";
    scrollToDay(selectedDate, behavior);
    const id = window.setTimeout(
      () => syncFromScroll(),
      behavior === "smooth" ? SCROLL_ANIM_MS : 50,
    );
    return () => window.clearTimeout(id);
  }, [loading, reduceMotion, scrollToDay, selectedDate, syncFromScroll]);

  useEffect(() => {
    if (loading) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    syncFromScroll();
    scroller.addEventListener("scroll", syncFromScroll, { passive: true });
    scroller.addEventListener("scrollend", syncFromScroll);
    window.addEventListener("resize", syncFromScroll);
    return () => {
      scroller.removeEventListener("scroll", syncFromScroll);
      scroller.removeEventListener("scrollend", syncFromScroll);
      window.removeEventListener("resize", syncFromScroll);
      if (ignoreClearTimerRef.current) clearTimeout(ignoreClearTimerRef.current);
    };
  }, [loading, syncFromScroll]);

  // Arrow keys (when the timeline pane is focused) step one day.
  useEffect(() => {
    if (loading) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (document.activeElement !== scroller) return;
      event.preventDefault();
      const idx = days.indexOf(activeIsoRef.current);
      if (idx < 0) return;
      const nextIdx = event.key === "ArrowDown" ? idx + 1 : idx - 1;
      const iso = days[nextIdx];
      if (!iso) return;
      activeIsoRef.current = iso;
      setActiveIso(iso);
      lastEmittedDateRef.current = iso;
      onDateChange?.(iso);
      scrollToDay(iso, reduceMotion ? "auto" : "smooth");
    };

    scroller.addEventListener("keydown", onKeyDown);
    return () => scroller.removeEventListener("keydown", onKeyDown);
  }, [days, loading, onDateChange, reduceMotion, scrollToDay]);

  if (loading) {
    return <PlanTimelineSkeleton />;
  }

  return (
    <Card className="relative overflow-hidden !px-4 !pb-4 !pt-[60px] max-lg:!px-3 max-lg:!pb-3 max-lg:!pt-10">
      {!selectedPast && onAddTask ? (
        <div className="absolute right-2 top-2 z-30 max-lg:right-1.5 max-lg:top-1.5">
          <PlanAddTaskButton onClick={onAddTask} />
        </div>
      ) : null}

      {!viewportReady ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 top-[60px] z-20 px-1 max-lg:top-10"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--color-surface) 94%, transparent)",
          }}
        >
          <PlanTimelineSkeleton embedded />
        </div>
      ) : null}

      <div
        ref={scrollerRef}
        className={`mentor-plan-timeline-scroll transition-opacity duration-200 ease-out motion-reduce:transition-none ${
          viewportReady ? "opacity-100" : "opacity-0"
        }`}
        tabIndex={viewportReady ? 0 : -1}
        aria-label={t("timeline_scroll_aria")}
        aria-hidden={!viewportReady}
      >
        <div className="relative">
          <div ref={railRef} className="mentor-plan-timeline-rail" aria-hidden>
            <div
              className="mentor-plan-timeline-rail-line"
              style={{ backgroundColor: "var(--color-progress-track)" }}
            />
            <div
              className="mentor-plan-timeline-rail-line"
              style={{
                top: 0,
                bottom: "auto",
                backgroundColor: "var(--color-progress)",
                height: `${Math.round(fillRatio * 1000) / 10}%`,
                transition: reduceMotion
                  ? undefined
                  : "height 320ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </div>

          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {formatDateLabel(activeIso, locale, t("today"), {
              alwaysFull: true,
            })}
          </div>

          <div className="flex flex-col">
            {days.map((iso) => {
              const dayTasks = weekTasks[iso] ?? [];
              const pending = dayTasks.filter((task) => task.status !== "DONE");
              const done = dayTasks.filter((task) => task.status === "DONE");
              const ordered = [...pending, ...done];
              const stats = taskStats(dayTasks);
              const dayReadOnly = isPastDate(iso);
              const isActive = iso === activeIso;
              const isToday = iso === todayIso();
              const badge = formatMonthDayShort(iso, locale);

              return (
                <section
                  key={iso}
                  id={planTimelineDayId(iso)}
                  className="mentor-plan-timeline-day relative"
                  data-active={isActive ? "true" : undefined}
                  aria-labelledby={`${planTimelineDayId(iso)}-label`}
                >
                  {isActive ? (
                    <motion.div
                      layoutId={
                        reduceMotion ? undefined : "plan-timeline-day-badge"
                      }
                      className="mentor-plan-timeline-badge pointer-events-none absolute top-0 z-20 flex h-11 w-11 flex-col items-center justify-center rounded-full border-2 border-[var(--color-surface)] text-center shadow-[var(--shadow-card)] max-lg:h-9 max-lg:w-9"
                      style={{ backgroundColor: "var(--color-progress)" }}
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 420, damping: 34 }
                      }
                      aria-hidden
                    >
                      <span
                        className="text-[11px] font-bold leading-none text-white max-lg:text-[10px]"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {badge.day}
                        <br />
                        {badge.month}
                      </span>
                    </motion.div>
                  ) : (
                    <button
                      type="button"
                      className="mentor-plan-timeline-dot pointer-events-auto absolute top-3 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 max-lg:top-2.5 max-lg:h-3 max-lg:w-3"
                      style={{
                        backgroundColor: isToday
                          ? "var(--color-progress)"
                          : "var(--color-surface)",
                        border: `2px solid ${
                          isToday
                            ? "var(--color-progress)"
                            : "var(--color-progress-track)"
                        }`,
                        opacity: dayReadOnly ? 0.75 : 1,
                      }}
                      aria-label={formatDateLabel(iso, locale, t("today"), {
                        alwaysFull: true,
                      })}
                      onClick={() => onDateChange?.(iso)}
                    />
                  )}

                  <header
                    className={`mb-2 flex items-center justify-between gap-2 max-lg:mb-1.5 ${isActive ? "min-h-11 max-lg:min-h-9" : "min-h-8 pt-1 max-lg:min-h-7"}`}
                  >
                    <h3
                      id={`${planTimelineDayId(iso)}-label`}
                      className="mentor-plan-timeline-day-title text-sm font-bold"
                      style={{
                        color: isActive
                          ? "var(--color-main)"
                          : "var(--color-body)",
                        fontFamily: "var(--font-heading)",
                      }}
                    >
                      {isToday
                        ? t("today")
                        : formatDateLabel(iso, locale, t("today"), {
                            alwaysFull: true,
                          })}
                    </h3>
                    {stats.total > 0 ? (
                      <span
                        className="mentor-plan-timeline-day-meta shrink-0 text-xs tabular-nums"
                        style={{ color: "var(--color-secondary)" }}
                      >
                        {stats.done}/{stats.total}
                      </span>
                    ) : null}
                  </header>

                  {ordered.length === 0 ? (
                    <p
                      className="mentor-plan-timeline-day-empty py-1 text-sm"
                      style={{ color: "var(--color-secondary)" }}
                    >
                      {t("timeline_day_empty")}
                    </p>
                  ) : (
                    <div className="flex flex-col">
                      {ordered.map((task) => (
                        <PlanTaskRow
                          key={task.id}
                          task={task}
                          busy={busyId === task.id}
                          readOnly={dayReadOnly}
                          dense
                          onToggle={() => onToggle(task.id)}
                          onEdit={() => onEdit(task)}
                          onDelete={() => onDelete(task)}
                          showCompletionPrompt={completionPromptTaskId === task.id}
                          onDismissCompletionPrompt={onDismissCompletionPrompt}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <div
            ref={spacerRef}
            aria-hidden
            className="pointer-events-none"
            style={{ height: endSpacerPx }}
          />
        </div>
      </div>
    </Card>
  );
}
