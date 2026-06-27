"use client";

import type { PlanTaskDto } from "@mentor/types";
import { Card, SectionHeading } from "@mentor/ui";
import { useTranslations } from "next-intl";
import { PlanWeekSkeleton } from "./plan-content-skeleton";
import { PlanTaskRow } from "./plan-task-row";

/** Hafta view — tasks for selected day only (date bar lives in PlanDateNav). */
export function PlanWeekView({
  selectedDate,
  weekTasks,
  loading,
  busyId,
  readOnly,
  onToggle,
  onMenu,
}: {
  selectedDate: string;
  weekTasks: Record<string, PlanTaskDto[]>;
  loading: boolean;
  busyId: string | null;
  readOnly?: boolean;
  onToggle: (id: string) => void;
  onMenu: (task: PlanTaskDto) => void;
}) {
  const t = useTranslations("plan");
  const selectedTasks = loading ? [] : (weekTasks[selectedDate] ?? []);

  if (loading) {
    return <PlanWeekSkeleton />;
  }

  return (
    <Card>
      <SectionHeading>{t("tasks_title")}</SectionHeading>

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
              onMenu={() => onMenu(task)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
