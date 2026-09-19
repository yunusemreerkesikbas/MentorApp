"use client";
import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { ComposerDayPicker } from "./composer-day-picker";
import { monday, shiftDate, type PlanningState } from "./planning-state";
import type { usePlanningTasks } from "./use-planning-tasks";

export function PlanningWeek({ state, setState, today, limit, days, counts, existingCounts, data, showWeek }: {
 state: PlanningState; setState: Dispatch<SetStateAction<PlanningState>>; today: string; limit: string;
 days: string[]; counts: Map<string, number>; existingCounts?: Map<string, number>;
 data: ReturnType<typeof usePlanningTasks>; showWeek: (week: string) => void;
}) {
 const t = useTranslations("mentorship");
 return <>          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={state.week <= monday(today)}
              onClick={() => showWeek(shiftDate(state.week, -7))}
            >
              {t("planning_previous")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => showWeek(monday(today))}
            >
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
            <p>
              {state.week} – {shiftDate(state.week, 6)}
            </p>
          </div>
          <ComposerDayPicker
            days={days}
            selectedDate={state.day}
            counts={counts}
            existingCounts={existingCounts}
            onSelect={(day) => setState((s) => ({ ...s, day }))}
          />
          <p className="text-sm">{t("planning_counts")}</p>
          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">{t("planning_existing")}</h3>
            {data.error ? (
              <Button type="button" onClick={data.retry}>
                {t("planning_retry")}
              </Button>
            ) : data.rows === null ? (
              <p role="status">{t("loading")}</p>
            ) : (
              <>
                {data.rows.filter((r) => r.taskDate === state.day).length ===
                  0 && <p>{t("planning_empty")}</p>}
                {data.rows
                  .filter((r) => r.taskDate === state.day)
                  .map((r) => (
                    <p key={r.id}>
                      {r.title} ·{" "}
                      {t(
                        r.status === "DONE"
                          ? "planning_filter_DONE"
                          : "planning_filter_PENDING",
                      )}
                    </p>
                  ))}
              </>
            )}
          </section>
</>;
}
