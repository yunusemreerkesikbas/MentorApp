"use client";

import type { PlanTaskDto } from "@mentor/types";
import { SectionHeading } from "@mentor/ui";
import { useLocale, useTranslations } from "next-intl";
import { PlanAddTaskButton } from "./plan-add-task-button";
import { PlanProgress } from "./plan-progress";
import { PlanTaskRow } from "./plan-task-row";
import { formatDateLabel, taskStats } from "./plan-utils";

/**
 * Selected day's tasks as checkable todos — the Takvim left rail on desktop and the "Ajanda"
 * scale on mobile. Renders bare (no Card): the caller owns the surface it sits on.
 */
export function PlanDayTodoList({
  selectedDate,
  tasksByDate,
  busyId,
  readOnly,
  onToggle,
  onEdit,
  onDelete,
  onAddTask,
  completionPromptTaskId,
  onDismissCompletionPrompt,
}: {
  selectedDate: string;
  tasksByDate: Record<string, PlanTaskDto[]>;
  busyId: string | null;
  readOnly?: boolean;
  onToggle: (id: string) => void;
  onEdit: (task: PlanTaskDto) => void;
  onDelete: (task: PlanTaskDto) => void;
  onAddTask?: () => void;
  completionPromptTaskId?: string | null;
  onDismissCompletionPrompt?: () => void;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const tasks = tasksByDate[selectedDate] ?? [];
  const progress = taskStats(tasks);
  const dayHeading = formatDateLabel(selectedDate, locale, t("today"), {
    alwaysFull: true,
  });

  return (
    <div className="flex min-w-0 flex-col">
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
          <div className="flex items-center justify-between gap-3 text-sm font-semibold">
            <span style={{ color: "var(--color-main)" }}>
              {t("progress", { done: progress.done, total: progress.total })}
            </span>
            <span
              className="shrink-0 tabular-nums"
              style={{ color: "var(--color-secondary)" }}
            >
              {t("progress_percent", { percent: progress.percent })}
            </span>
          </div>
          <PlanProgress value={progress.percent} />
        </div>
      ) : null}

      {tasks.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("empty_desc")}
        </p>
      ) : (
        <div className="mt-3 flex flex-col">
          {tasks.map((task) => (
            <PlanTaskRow
              key={task.id}
              task={task}
              dense
              busy={busyId === task.id}
              readOnly={readOnly}
              onToggle={() => onToggle(task.id)}
              onEdit={() => onEdit(task)}
              onDelete={() => onDelete(task)}
              showCompletionPrompt={completionPromptTaskId === task.id}
              onDismissCompletionPrompt={onDismissCompletionPrompt}
            />
          ))}
        </div>
      )}
    </div>
  );
}
