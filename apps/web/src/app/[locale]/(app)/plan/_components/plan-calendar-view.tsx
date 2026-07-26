"use client";

import type { PlanTaskDto } from "@mentor/types";
import { Card } from "@mentor/ui";
import Plus from "lucide-react/dist/esm/icons/plus.mjs";
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { monthGridDays } from "@/lib/plan-calendar-layout";
import { PlanCalendarHeader } from "./plan-calendar-header";
import { PlanCalendarSkeleton } from "./plan-content-skeleton";
import { PlanDayTodoList } from "./plan-day-todo-list";
import { PlanEventPreview, usePlanEventPreview } from "./plan-event-preview";
import { PlanMobileAgenda } from "./plan-mobile-agenda";
import { PlanMobileDateStrip } from "./plan-mobile-date-strip";
import { PlanMonthGrid } from "./plan-month-grid";
import { PlanTimeGrid } from "./plan-time-grid";
import { PlanWeekMiniCalendar } from "./plan-week-mini-calendar";
import {
  formatDateLabel,
  monthStart,
  weekDates,
  type PlanCalendarScale,
} from "./plan-utils";

/**
 * Takvim view — planning context in the left rail (desktop) + the calendar surface.
 *
 * The Gün/Hafta/Ay scales share one hour-grid component; only Ay has its own board. On mobile the
 * "Hafta" scale renders the day agenda instead of a seven-column grid (see the header note).
 */
export function PlanCalendarView({
  scale,
  selectedDate,
  weekStartDate,
  tasksByDate,
  loading,
  busyId,
  readOnly,
  onScaleChange,
  onStep,
  onToday,
  onDateChange,
  onToggle,
  onEdit,
  onDelete,
  onOpenEvent,
  onAddTask,
}: {
  scale: PlanCalendarScale;
  selectedDate: string;
  weekStartDate: string;
  /** Whatever range the shell has loaded for the current scale. */
  tasksByDate: Record<string, PlanTaskDto[]>;
  loading: boolean;
  busyId: string | null;
  readOnly?: boolean;
  onScaleChange: (scale: PlanCalendarScale) => void;
  onStep: (direction: -1 | 1) => void;
  onToday: () => void;
  onDateChange: (iso: string) => void;
  onToggle: (id: string) => void;
  onEdit: (task: PlanTaskDto) => void;
  onDelete: (task: PlanTaskDto) => void;
  /** Mobile tap on an event → details sheet (desktop uses hover preview + click-to-edit). */
  onOpenEvent: (task: PlanTaskDto) => void;
  /** Slot/day click → add sheet, optionally prefilled with a date and start time. */
  onAddTask: (prefill?: {
    taskDate?: string;
    startTime?: string;
    origin?: "calendar";
  }) => void;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const { preview, onHover } = usePlanEventPreview();
  const monthAnchor = monthStart(selectedDate);
  const monthDays = useMemo(() => {
    const d = new Date(`${monthAnchor}T12:00:00`);
    return monthGridDays(d.getFullYear(), d.getMonth());
  }, [monthAnchor]);

  if (loading) return <PlanCalendarSkeleton />;

  const header = (
    <PlanCalendarHeader
      scale={scale}
      selectedDate={selectedDate}
      weekStartDate={weekStartDate}
      monthAnchor={monthAnchor}
      onScaleChange={onScaleChange}
      onStep={onStep}
      onToday={onToday}
    />
  );

  // Every add that starts on the calendar surface uses the "event" wording.
  const addOnCalendar = (prefill: { taskDate: string; startTime?: string }) =>
    onAddTask({ ...prefill, origin: "calendar" });

  const todoProps = {
    selectedDate,
    tasksByDate,
    busyId,
    readOnly,
    onToggle,
    onEdit,
    onDelete,
    onAddTask: () => addOnCalendar({ taskDate: selectedDate }),
  };

  // Clicking any calendar event opens the details sheet — on desktop the hover preview already
  // covers the quick glance, so the click is free to carry the fuller view (with Edit / Sil).
  const gridProps = {
    selectedDate,
    weekTasks: tasksByDate,
    onDateChange,
    onOpenTask: onOpenEvent,
    onCreateAt: (iso: string, startTime: string) =>
      addOnCalendar({ taskDate: iso, startTime }),
    onHover,
  };

  const monthProps = {
    monthAnchor,
    selectedDate,
    tasksByDate,
    onDateChange,
    onOpenTask: onOpenEvent,
    onCreateAt: (iso: string) => addOnCalendar({ taskDate: iso }),
    onHover,
  };

  return (
    <>
      {/* grid-rows minmax(0,1fr): without it the row is `auto`, the children size to content and
          the min-h-0 chain below them has nothing to shrink against. */}
      <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-6">
        {/* Planning rail: month picker on top, the picked day's todos underneath. */}
        <div className="hidden lg:flex lg:min-h-0 lg:flex-col lg:gap-4">
          <PlanWeekMiniCalendar
            selectedDate={selectedDate}
            weekStartDate={weekStartDate}
            onDateChange={onDateChange}
          />
          <Card className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <PlanDayTodoList {...todoProps} />
          </Card>
        </div>

        {/* Tighter gutter on mobile so the seven day columns get the width instead. */}
        <Card className="flex min-w-0 flex-col gap-4 !p-3 lg:!p-6 lg:min-h-0 lg:flex-1">
          <div className="shrink-0">{header}</div>

          {/* Mobile: one board serves as both the date strip and the month view — dragging its
              handle reveals the remaining weeks, so Ay needs no separate grid underneath. */}
          <PlanMobileDateStrip
            weekStartDate={weekStartDate}
            selectedDate={selectedDate}
            tasksByDate={tasksByDate}
            expanded={scale === "month"}
            onDateChange={onDateChange}
            onOpenTask={onOpenEvent}
            onExpand={() => onScaleChange("month")}
            onCollapse={() => onScaleChange("day")}
          />

          {scale === "month" ? (
            <div className="hidden lg:block lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <PlanMonthGrid {...monthProps} />
            </div>
          ) : scale === "day" ? (
            <PlanTimeGrid {...gridProps} days={[selectedDate]} readOnlyAll={readOnly} />
          ) : (
            <>
              {/* Hafta: full seven-column grid on desktop only. */}
              <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
                <PlanTimeGrid {...gridProps} days={weekDates(weekStartDate)} />
              </div>
              <PlanMobileAgenda
                days={monthDays}
                selectedDate={selectedDate}
                tasksByDate={tasksByDate}
                onDateChange={onDateChange}
                onOpenTask={onOpenEvent}
              />
            </>
          )}
        </Card>
      </div>

      {/* Mobile add affordance — sits above the app tab bar. */}
      {!readOnly ? (
        <button
          type="button"
          onClick={() => addOnCalendar({ taskDate: selectedDate })}
          aria-label={t("calendar_add_on", {
            date: formatDateLabel(selectedDate, locale, t("today"), {
              alwaysFull: true,
            }),
          })}
          className="fixed right-5 bottom-[calc(96px+env(safe-area-inset-bottom))] z-40 flex size-14 cursor-pointer items-center justify-center rounded-full shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 lg:hidden"
          style={{ backgroundColor: "var(--color-main)", color: "#fff" }}
        >
          <Plus size={26} strokeWidth={2.5} aria-hidden />
        </button>
      ) : null}

      <PlanEventPreview preview={preview} />
    </>
  );
}
