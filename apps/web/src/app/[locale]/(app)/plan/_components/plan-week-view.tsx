"use client";

import type { PlanTaskDto } from "@mentor/types";
import { Card, ProgressBar } from "@mentor/ui";
import { useLocale, useTranslations } from "next-intl";
import { PlanWeekSkeleton } from "./plan-content-skeleton";
import { PlanProgress } from "./plan-progress";
import { PlanTaskRow } from "./plan-task-row";
import {
  formatDateLabel,
  taskStats,
  todayIso,
} from "./plan-utils";

/** Mobile Hafta — selected-day task card. Desktop uses PlanWeekDesktopLayout. */
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
  const locale = useLocale();
  const selectedTasks = loading ? [] : (weekTasks[selectedDate] ?? []);
  const progress = taskStats(selectedTasks);
  const isToday = selectedDate === todayIso();
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
      <div className="flex flex-wrap items-center gap-2">
        <h2
          className="text-base font-semibold"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {dayHeading}
        </h2>
        {isToday ? (
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-bold"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--color-progress-track) 45%, transparent)",
              color: "var(--color-progress)",
              fontFamily: "var(--font-body)",
            }}
          >
            {t("today")}
          </span>
        ) : null}
      </div>

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
              onMenu={() => onMenu(task)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
