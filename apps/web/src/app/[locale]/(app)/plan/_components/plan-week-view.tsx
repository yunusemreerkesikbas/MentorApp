"use client";

import type { PlanTaskDto } from "@mentor/types";
import { Card, SectionHeading } from "@mentor/ui";
import { useLocale, useTranslations } from "next-intl";
import { PlanAddTaskButton } from "./plan-add-task-button";
import { PlanWeekSkeleton } from "./plan-content-skeleton";
import { PlanProgress } from "./plan-progress";
import { PlanTaskRow } from "./plan-task-row";
import { formatDateLabel, taskStats } from "./plan-utils";

/** Mobile Hafta — selected-day task card. Desktop uses PlanWeekDesktopLayout. */
export function PlanWeekView({
  selectedDate,
  weekTasks,
  loading,
  busyId,
  readOnly,
  onToggle,
  onEdit,
  onDelete,
  onAddTask,
}: {
  selectedDate: string;
  weekTasks: Record<string, PlanTaskDto[]>;
  loading: boolean;
  busyId: string | null;
  readOnly?: boolean;
  onToggle: (id: string) => void;
  onEdit: (task: PlanTaskDto) => void;
  onDelete: (task: PlanTaskDto) => void;
  onAddTask?: () => void;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const selectedTasks = loading ? [] : (weekTasks[selectedDate] ?? []);
  const progress = taskStats(selectedTasks);
  const dayHeading = formatDateLabel(selectedDate, locale, t("today"), {
    alwaysFull: true,
  });

  if (loading) {
    return (
      <div className="lg:hidden">
        <PlanWeekSkeleton />
      </div>
    );
  }

  return (
    <Card className="lg:hidden">
      <SectionHeading
        action={
          !readOnly && onAddTask ? (
            <PlanAddTaskButton onClick={onAddTask} />
          ) : undefined
        }
      >
        {dayHeading}
      </SectionHeading>

      {progress.total > 0 ? (
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span style={{ color: "var(--color-main)" }}>
              {t("progress", { done: progress.done, total: progress.total })}
            </span>
            <span style={{ color: "var(--color-secondary)" }}>
              {t("progress_percent", { percent: progress.percent })}
            </span>
          </div>
          <PlanProgress value={progress.percent} />
        </div>
      ) : null}

      {selectedTasks.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("empty_desc")}
        </p>
      ) : (
        <div className="mt-3 flex flex-col">
          {selectedTasks.map((task) => (
            <PlanTaskRow
              key={task.id}
              task={task}
              dense
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
  );
}
