"use client";
import type { Dispatch, SetStateAction } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Skeleton } from "@mentor/ui";
import { PANEL_QUIET_BUTTON } from "@/components/mentorship/coach-ui";
import { ComposerDayPicker } from "./composer-day-picker";
import {
  followDay,
  monday,
  shiftDate,
  type AssignDraft,
  type PlanningState,
} from "./planning-state";
import { TaskMark, TaskStatus } from "./task-mark";
import { useReportDates } from "./use-report-dates";
import type { usePlanningTasks } from "./use-planning-tasks";

export const PLANNER_SUBHEAD = "text-caption font-extrabold text-[var(--color-secondary)]";

const WEEK_ARROW =
  "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-main)] outline-none hover:bg-[var(--color-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:text-[var(--color-secondary)] disabled:opacity-40 disabled:hover:bg-transparent";

/**
 * The top of the planner: the week between two arrows, its seven days, and what the chosen day
 * already holds on the student's plan (the coach's tasks under the cap, the student's own under the
 * book), so a new task is written knowing what is there.
 */
export function PlanningWeek({
  state,
  setState,
  drafts,
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
  drafts: readonly AssignDraft[];
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
  const current = monday(today);
  const rows = (data.rows ?? []).filter((row) => row.taskDate === state.day);

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className={WEEK_ARROW}
          aria-label={t("planning_previous")}
          disabled={state.week <= current}
          onClick={() => showWeek(shiftDate(state.week, -7))}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="flex min-w-0 flex-col items-center">
          <p className="text-base font-extrabold text-[var(--color-main)]">
            {dates.range(state.week, shiftDate(state.week, 6))}
          </p>
          {state.week === current ? (
            <span className="text-caption font-semibold text-[var(--color-secondary)]">
              {t("assign_week_this")}
            </span>
          ) : (
            <button type="button" className={`${PANEL_QUIET_BUTTON} min-h-0 text-caption`} onClick={() => showWeek(current)}>
              {t("planning_week_back")}
            </button>
          )}
        </div>
        <button
          type="button"
          className={WEEK_ARROW}
          aria-label={t("assign_week_next")}
          disabled={shiftDate(state.week, 7) > limit}
          onClick={() => showWeek(shiftDate(state.week, 7))}
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
      <ComposerDayPicker
        days={days}
        selectedDate={state.day}
        counts={counts}
        existingCounts={existingCounts}
        onSelect={(day) =>
          setState((s) => ({ ...s, day, editor: followDay(s.editor, day, drafts) }))
        }
      />
      <section className="flex flex-col">
        <h3 className={PLANNER_SUBHEAD}>
          {dates.longDay(state.day)} · {t("planning_existing")}
        </h3>
        {data.error ? (
          <div role="alert" className="mt-2 flex flex-col items-start gap-2">
            <p className="text-body-sm font-semibold text-[var(--color-body)]">{data.error}</p>
            <Button type="button" variant="secondary" size="sm" onClick={data.retry}>
              {t("planning_retry")}
            </Button>
          </div>
        ) : data.rows === null ? (
          <div role="status" aria-label={t("loading")} className="mt-2">
            <Skeleton className="h-12 w-full rounded-[var(--radius-card)]" />
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-1 text-body-sm font-semibold text-[var(--color-secondary)]">{t("planning_empty")}</p>
        ) : (
          <ul className="flex flex-col">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 border-t border-[var(--play-line)] py-2.5 first:border-t-0"
              >
                <TaskMark byCoach={row.assignedByCoach} />
                <span className="min-w-0 flex-1 text-body-sm font-extrabold leading-snug text-[var(--color-main)]">
                  {row.title}
                  {row.assignedByCoach ? null : (
                    // The mark already says it to a screen reader.
                    <span aria-hidden className="block text-caption font-semibold text-[var(--color-secondary)]">
                      {t("plan_mark_own")}
                    </span>
                  )}
                </span>
                <TaskStatus done={row.status === "DONE"} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
