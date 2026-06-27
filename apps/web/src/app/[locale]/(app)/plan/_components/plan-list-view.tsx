"use client";

import type { PlanTaskDto } from "@mentor/types";
import { Card, SectionHeading } from "@mentor/ui";
import { useTranslations } from "next-intl";
import { PlanListSkeleton } from "./plan-content-skeleton";
import { PlanTaskRow } from "./plan-task-row";

export function PlanListView({
  tasks,
  loading,
  busyId,
  readOnly,
  onToggle,
  onMenu,
}: {
  tasks: PlanTaskDto[];
  loading: boolean;
  busyId: string | null;
  readOnly?: boolean;
  onToggle: (id: string) => void;
  onMenu: (task: PlanTaskDto) => void;
}) {
  const t = useTranslations("plan");
  const visible = loading ? [] : tasks;

  if (loading) {
    return <PlanListSkeleton />;
  }

  return (
    <Card>
      <SectionHeading>{t("tasks_title")}</SectionHeading>

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
                onMenu={() => onMenu(task)}
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
    <div className="mt-4 flex flex-col items-center gap-4 py-6 text-center">
      <span
        className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold capitalize"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--color-chip) 30%, transparent)",
          color: "var(--color-chip-text)",
          fontFamily: "var(--font-body)",
        }}
      >
        {t("empty_chip")}
      </span>
      <p className="text-base" style={{ color: "var(--color-secondary)" }}>
        {t("empty_desc")}
      </p>
    </div>
  );
}
