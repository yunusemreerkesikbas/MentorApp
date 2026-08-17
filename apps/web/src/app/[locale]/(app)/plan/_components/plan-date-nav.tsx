"use client";

import { useTranslations } from "next-intl";
import type { PlanTaskDto } from "@mentor/types";
import { Card } from "@mentor/ui";
import { PlanProgress } from "./plan-progress";
import { PlanWeekStrip } from "./plan-week-strip";

export type PlanDateNavProps = {
  date: string;
  weekStartDate: string;
  weekTasks: Record<string, PlanTaskDto[]>;
  progress?: { done: number; total: number; percent: number };
  onDateChange: (iso: string) => void;
  onWeekChange: (weekStart: string) => void;
  onOpenCalendar: () => void;
};

/** Day navigator for Liste / Timeline — week strip + day progress. */
export function PlanDateNav({
  weekStartDate,
  weekTasks,
  progress,
  onDateChange,
  onWeekChange,
  onOpenCalendar,
  date,
}: PlanDateNavProps) {
  const t = useTranslations("plan");

  return (
    <Card className="flex flex-col gap-3 !p-4 lg:!p-6">
      <PlanWeekStrip
        weekStartDate={weekStartDate}
        selectedDate={date}
        weekTasks={weekTasks}
        onWeekChange={onWeekChange}
        onDateChange={onDateChange}
        onOpenCalendar={onOpenCalendar}
        hideSummary
      />

      {progress && progress.total > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-[color-mix(in_srgb,var(--color-border)_70%,transparent)] pt-3">
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
    </Card>
  );
}
