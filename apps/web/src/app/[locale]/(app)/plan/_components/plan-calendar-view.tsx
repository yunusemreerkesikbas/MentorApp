"use client";

import type { PlanTaskDto, PublicHolidayDto } from "@mentor/types";
import { Card } from "@mentor/ui";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { monthGridDays } from "@/lib/plan-calendar-layout";
import { planTaskCalendarItems } from "@/lib/plan-calendar-item";
import { listPlanTaskCalendarDates } from "@/lib/plan-tasks";
import { PlanCalendarFab } from "./plan-calendar-fab";
import { PlanCalendarFrame } from "./plan-calendar-frame";
import { PlanCalendarHeader } from "./plan-calendar-header";
import { PlanCalendarSkeleton } from "./plan-content-skeleton";
import { PlanDayTodoList } from "./plan-day-todo-list";
import { PlanEventPreview, usePlanEventPreview } from "./plan-event-preview";
import { PlanMobileAgenda } from "./plan-mobile-agenda";
import { PlanMobileDateStrip } from "./plan-mobile-date-strip";
import { PlanMonthGrid } from "./plan-month-grid";
import { PlanSubjectLegend } from "./plan-subject-legend";
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
  holidaysByDate,
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
  completionPromptTaskId,
  onDismissCompletionPrompt,
}: {
  scale: PlanCalendarScale;
  selectedDate: string;
  weekStartDate: string;
  /** Whatever range the shell has loaded for the current scale. */
  tasksByDate: Record<string, PlanTaskDto[]>;
  /** Verified public holidays for the same range — display only, never editable. */
  holidaysByDate: Record<string, PublicHolidayDto>;
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
  completionPromptTaskId?: string | null;
  onDismissCompletionPrompt?: () => void;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const { preview, onHover } = usePlanEventPreview<PlanTaskDto>();
  const [pickedSubject, setPickedSubject] = useState<string | null>(null);
  const monthAnchor = monthStart(selectedDate);
  const monthDays = useMemo(() => {
    const d = new Date(`${monthAnchor}T12:00:00`);
    return monthGridDays(d.getFullYear(), d.getMonth());
  }, [monthAnchor]);
  const itemsByDate = useMemo(
    () =>
      planTaskCalendarItems(tasksByDate, {
        done: t("calendar_preview_done"),
        hint: t("calendar_preview_hint"),
      }),
    [t, tasksByDate],
  );

  /**
   * The legend only exists on Ay, and a subject can vanish when the user steps to a month where
   * they never studied it. Deriving the effective highlight (instead of storing it) means the
   * board can never end up permanently faded against a subject that isn't on it.
   */
  const monthKey = monthAnchor.slice(0, 7);
  const highlightSubject = useMemo(() => {
    if (scale !== "month" || !pickedSubject) return null;
    for (const [iso, tasks] of Object.entries(tasksByDate)) {
      if (iso.slice(0, 7) !== monthKey) continue;
      if (tasks.some((task) => task.subject?.trim() === pickedSubject)) {
        return pickedSubject;
      }
    }
    return null;
  }, [scale, pickedSubject, tasksByDate, monthKey]);

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
    completionPromptTaskId,
    onDismissCompletionPrompt,
  };

  // Clicking any calendar event opens the details sheet — on desktop the hover preview already
  // covers the quick glance, so the click is free to carry the fuller view (with Edit / Sil).
  const gridProps = {
    selectedDate,
    itemsByDate,
    holidaysByDate,
    onDateChange,
    onOpenItem: onOpenEvent,
    onCreateAt: (iso: string, startTime: string) =>
      addOnCalendar({ taskDate: iso, startTime }),
    onHover,
  };

  const monthProps = {
    monthAnchor,
    selectedDate,
    itemsByDate,
    holidaysByDate,
    highlightGroup: highlightSubject,
    onDateChange,
    onOpenItem: onOpenEvent,
    onCreateAt: (iso: string) => addOnCalendar({ taskDate: iso }),
    onHover,
  };

  return (
    <>
      <PlanCalendarFrame
        rail={
          <>
            <PlanWeekMiniCalendar
              selectedDate={selectedDate}
              weekStartDate={weekStartDate}
              loadMarkedDates={listPlanTaskCalendarDates}
              onDateChange={onDateChange}
            />
            <Card className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <PlanDayTodoList {...todoProps} />
            </Card>
          </>
        }
      >
        <div className="shrink-0">{header}</div>

        {/* Mobile: one board serves as both the date strip and the month view — dragging its
            handle reveals the remaining weeks, so Ay needs no separate grid underneath. */}
        <PlanMobileDateStrip
          weekStartDate={weekStartDate}
          selectedDate={selectedDate}
          itemsByDate={itemsByDate}
          holidaysByDate={holidaysByDate}
          highlightGroup={highlightSubject}
          expanded={scale === "month"}
          onDateChange={onDateChange}
          onOpenItem={onOpenEvent}
          onExpand={() => onScaleChange("month")}
          onCollapse={() => onScaleChange("day")}
        />

        {scale === "month" ? (
          <>
            <div className="hidden lg:block lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <PlanMonthGrid {...monthProps} />
            </div>
            {/* Decodes the colors AND doubles as the highlight control — mobile's board is the
                expanded strip above, so one legend serves both. */}
            <PlanSubjectLegend
              monthKey={monthKey}
              tasksByDate={tasksByDate}
              activeSubject={highlightSubject}
              onSelect={setPickedSubject}
            />
          </>
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
              itemsByDate={itemsByDate}
              holidaysByDate={holidaysByDate}
              onDateChange={onDateChange}
              onOpenItem={onOpenEvent}
            />
          </>
        )}
      </PlanCalendarFrame>

      {!readOnly ? (
        <PlanCalendarFab
          label={t("calendar_add_on", {
            date: formatDateLabel(selectedDate, locale, t("today"), {
              alwaysFull: true,
            }),
          })}
          onClick={() => addOnCalendar({ taskDate: selectedDate })}
        />
      ) : null}

      <PlanEventPreview preview={preview} />
    </>
  );
}
