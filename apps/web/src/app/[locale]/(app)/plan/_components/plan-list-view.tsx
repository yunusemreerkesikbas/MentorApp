"use client";

import type { PlanTaskDto } from "@mentor/types";
import { Card, SectionHeading } from "@mentor/ui";
import { useTranslations } from "next-intl";
import { PlanAddTaskButton } from "./plan-add-task-button";
import { PlanListSkeleton } from "./plan-content-skeleton";
import { PlanTaskRow } from "./plan-task-row";

export function PlanListView({
  tasks,
  loading,
  busyId,
  readOnly,
  onToggle,
  onEdit,
  onDelete,
  onAddTask,
}: {
  tasks: PlanTaskDto[];
  loading: boolean;
  busyId: string | null;
  readOnly?: boolean;
  onToggle: (id: string) => void;
  onEdit: (task: PlanTaskDto) => void;
  onDelete: (task: PlanTaskDto) => void;
  onAddTask?: () => void;
}) {
  const t = useTranslations("plan");
  const visible = loading ? [] : tasks;

  if (loading) {
    return <PlanListSkeleton />;
  }

  return (
    <Card>
      <SectionHeading
        action={
          !readOnly && onAddTask ? (
            <PlanAddTaskButton onClick={onAddTask} />
          ) : undefined
        }
      >
        {t("tasks_title")}
      </SectionHeading>

      {visible.length === 0 ? (
        <PlanEmptyInline />
      ) : (
        <div className="mt-3 flex flex-col">
          {visible.map((task) => (
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
  );
}

function PlanEmptyInline() {
  const t = useTranslations("plan");
  return (
    <div className="mt-4 flex flex-col items-center py-6 text-center">
      <p className="text-base" style={{ color: "var(--color-secondary)" }}>
        {t("empty_desc")}
      </p>
    </div>
  );
}
