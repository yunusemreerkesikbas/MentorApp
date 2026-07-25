"use client";

import type { PlanTaskDto } from "@mentor/types";
import { Card, SectionHeading } from "@mentor/ui";
import { useLocale, useTranslations } from "next-intl";
import { PlanAddTaskButton } from "./plan-add-task-button";
import { PlanWeekDesktopSkeleton } from "./plan-content-skeleton";
import { PlanProgress } from "./plan-progress";
import { PlanTaskRow } from "./plan-task-row";
import { formatDateLabel, taskStats } from "./plan-utils";
import {
  PlanWeekMiniCalendar,
  PlanWeekSummaryList,
} from "./plan-week-mini-calendar";

/** Desktop Hafta — planning context (left) + execution panel (right). */
export function PlanWeekDesktopLayout({
  selectedDate,
  weekStartDate,
  weekTasks,
  loading,
  busyId,
  readOnly,
  onDateChange,
  onWeekChange,
  onToggle,
  onEdit,
  onDelete,
  onAddTask,
}: {
  selectedDate: string;
  weekStartDate: string;
  weekTasks: Record<string, PlanTaskDto[]>;
  loading: boolean;
  busyId: string | null;
  readOnly?: boolean;
  onDateChange: (iso: string) => void;
  onWeekChange: (weekStart: string) => void;
  onToggle: (id: string) => void;
  onEdit: (task: PlanTaskDto) => void;
  onDelete: (task: PlanTaskDto) => void;
  onAddTask: () => void;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const selectedTasks = weekTasks[selectedDate] ?? [];
  const dayProgress = taskStats(selectedTasks);
  const dayHeading = formatDateLabel(selectedDate, locale, t("today"), {
    alwaysFull: true,
  });

  if (loading) {
    return <PlanWeekDesktopSkeleton />;
  }

  return (
    <div className="hidden lg:grid lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] lg:items-start lg:gap-6">
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        <PlanWeekMiniCalendar
          selectedDate={selectedDate}
          weekStartDate={weekStartDate}
          onDateChange={onDateChange}
        />
        <PlanWeekSummaryList
          weekStartDate={weekStartDate}
          selectedDate={selectedDate}
          weekTasks={weekTasks}
          onDateChange={onDateChange}
          onWeekChange={onWeekChange}
        />
      </div>

      <Card className="flex min-w-0 flex-col gap-4">
        <SectionHeading
          action={
            !readOnly ? <PlanAddTaskButton onClick={onAddTask} /> : undefined
          }
        >
          {dayHeading}
        </SectionHeading>

        {dayProgress.total > 0 ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span style={{ color: "var(--color-main)" }}>
                {t("progress", {
                  done: dayProgress.done,
                  total: dayProgress.total,
                })}
              </span>
              <span
                className="shrink-0 tabular-nums"
                style={{ color: "var(--color-secondary)" }}
              >
                {t("progress_percent", { percent: dayProgress.percent })}
              </span>
            </div>
            <PlanProgress value={dayProgress.percent} />
          </div>
        ) : null}

        {selectedTasks.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {t("empty_desc")}
          </p>
        ) : (
          <div className="flex flex-col border-t border-white/30 pt-1">
            {selectedTasks.map((task) => (
              <PlanTaskRow
                key={task.id}
                task={task}
                busy={busyId === task.id}
                readOnly={readOnly}
                onToggle={() => onToggle(task.id)}
                onEdit={() => onEdit(task)}
                onDelete={() => onDelete(task)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
