"use client";
import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { Button, Skeleton } from "@mentor/ui";
import { ComposerDayPicker } from "./composer-day-picker";
import { monday, shiftDate, type PlanningState } from "./planning-state";
import { useReportDates } from "./use-report-dates";
import type { usePlanningTasks } from "./use-planning-tasks";

export const PLANNER_SUBHEAD = "text-caption font-extrabold text-[var(--color-secondary)]";

export function PlanningWeek({
  state,
  setState,
  today,
  limit,
  days,
  counts,
  existingCounts,
  data,
  showWeek,
}: {
  state: PlanningState;
  setState: Dispatch<SetStateAction<PlanningState>>;
  today: string;
  limit: string;
  days: string[];
  counts: Map<string, number>;
  existingCounts?: Map<string, number>;
  data: ReturnType<typeof usePlanningTasks>;
  showWeek: (week: string) => void;
}) {
  const t = useTranslations("mentorship");
  const dates = useReportDates();
  const rows = (data.rows ?? []).filter((row) => row.taskDate === state.day);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-extrabold text-[var(--color-main)]">
          {dates.range(state.week, shiftDate(state.week, 6))}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={state.week <= monday(today)}
            onClick={() => showWeek(shiftDate(state.week, -7))}
          >
            {t("planning_previous")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => showWeek(monday(today))}>
            {t("assign_week_this")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={shiftDate(state.week, 7) > limit}
            onClick={() => showWeek(shiftDate(state.week, 7))}
          >
            {t("assign_week_next")}
          </Button>
        </div>
      </div>
      <ComposerDayPicker
        days={days}
        selectedDate={state.day}
        counts={counts}
        existingCounts={existingCounts}
        onSelect={(day) => setState((s) => ({ ...s, day }))}
      />
      <p className="-mt-2 text-caption font-semibold text-[var(--color-secondary)]">{t("planning_counts")}</p>
      <section className="flex flex-col gap-1">
        <h3 className={PLANNER_SUBHEAD}>
          {dates.shortDay(state.day)} · {t("planning_existing")}
        </h3>
        {data.error ? (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="text-body-sm font-semibold text-[var(--color-body)]">{data.error}</p>
            <Button type="button" variant="secondary" size="sm" onClick={data.retry}>
              {t("planning_retry")}
            </Button>
          </div>
        ) : data.rows === null ? (
          <div role="status" aria-label={t("loading")}>
            <Skeleton className="h-16 w-full rounded-[var(--radius-card)]" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t("planning_empty")}</p>
        ) : (
          <ul className="flex flex-col">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 border-t border-[var(--play-line)] py-2.5 first:border-t-0"
              >
                <span className="min-w-0 text-body-sm font-extrabold text-[var(--color-main)]">{row.title}</span>
                <span
                  className={`shrink-0 text-caption font-extrabold ${row.status === "DONE" ? "text-[var(--color-success)]" : "text-[var(--color-secondary)]"}`}
                >
                  {t(row.status === "DONE" ? "task_status_DONE" : "task_status_PENDING")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
