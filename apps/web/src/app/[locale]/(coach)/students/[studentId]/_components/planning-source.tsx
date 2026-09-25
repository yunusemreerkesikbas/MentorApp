"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Skeleton } from "@mentor/ui";
import type { AssignDraft } from "./planning-state";
import {
  copyKey,
  copyTask,
  MAX_DRAFTS,
  monday,
  shiftDate,
} from "./planning-state";
import { todayInIstanbul } from "@/lib/date-time";
import { PLANNER_SUBHEAD } from "./planning-week";
import { useReportDates } from "./use-report-dates";
import { usePlanningTasks } from "./use-planning-tasks";

export function PlanningSource({
  studentId,
  target,
  count,
  copied,
  onAdd,
}: {
  studentId: string;
  target: string;
  count: number;
  copied: string[];
  onAdd: (drafts: AssignDraft[], keys: string[]) => void;
}) {
  const t = useTranslations("mentorship");
  const dates = useReportDates();
  const current = monday(todayInIstanbul());
  const [week, setWeek] = useState(shiftDate(current, -7));
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState<string[]>([]);
  const data = usePlanningTasks(studentId, week);
  const rows = (data.rows ?? []).filter((row) => row.assignedByCoach);
  const visible = rows.filter(
    (row) =>
      filter === "ALL" ||
      (filter === "DONE" ? row.status === "DONE" : row.status !== "DONE"),
  );
  const available = visible.filter(
    (row) => !copied.includes(copyKey(row.id, target)),
  );
  const chosen = rows.filter(
    (row) =>
      selected.includes(row.id) && !copied.includes(copyKey(row.id, target)),
  );
  const overflow = count + chosen.length > MAX_DRAFTS;
  return (
    <section className="flex flex-col gap-3">
      <h3 className={PLANNER_SUBHEAD}>{t("planning_source")}</h3>
      <div className="flex flex-wrap items-center gap-2">
        {[shiftDate(current, -7), current].map((value, i) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={week === value ? "soft" : "ghost"}
            aria-pressed={week === value}
            onClick={() => {
              setWeek(value);
              setSelected([]);
            }}
          >
            {t(i === 0 ? "planning_last_week" : "assign_week_this")}
          </Button>
        ))}
        <span className="text-caption font-semibold text-[var(--color-secondary)]">
          {dates.range(week, shiftDate(week, 6))}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {["ALL", "PENDING", "DONE"].map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={filter === value ? "soft" : "ghost"}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {t(`planning_filter_${value}`)}
          </Button>
        ))}
      </div>
      {data.error ? (
        <div role="alert" className="flex flex-col items-start gap-2">
          <p className="text-body-sm font-semibold text-[var(--color-body)]">{data.error}</p>
          <Button type="button" variant="secondary" size="sm" onClick={data.retry}>
            {t("planning_retry")}
          </Button>
        </div>
      ) : data.rows === null ? (
        <div role="status" aria-label={t("loading")}>
          <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
        </div>
      ) : (
        <>
          <Button
            type="button"
            variant="ghost"
            className="self-start"
            onClick={() =>
              setSelected((prev) => [
                ...new Set([...prev, ...available.map((r) => r.id)]),
              ])
            }
          >
            {t("planning_select_visible")}
          </Button>
          {visible.length === 0 && (
            <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t("planning_empty")}</p>
          )}
          {visible.map((row) => (
            <label
              key={row.id}
              className="flex min-h-11 cursor-pointer items-start gap-3 py-2"
            >
              <input
                type="checkbox"
                className="mt-1 size-5 accent-[var(--play-cta)]"
                disabled={copied.includes(copyKey(row.id, target))}
                checked={selected.includes(row.id)}
                onChange={(e) =>
                  setSelected((prev) =>
                    e.target.checked
                      ? [...prev, row.id]
                      : prev.filter((id) => id !== row.id),
                  )
                }
              />
              <span className="text-body-sm font-bold text-[var(--color-main)]">
                {row.title}
                <span className="block text-caption font-semibold text-[var(--color-secondary)]">
                  {[
                    dates.shortDay(row.taskDate),
                    row.subject,
                    row.topic,
                    t(row.status === "DONE" ? "task_status_DONE" : "task_status_PENDING"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </label>
          ))}
          {overflow && (
            <p role="alert" className="text-body-sm font-semibold text-[var(--color-body)]">
              {t("planning_capacity", { max: MAX_DRAFTS })}
            </p>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            disabled={chosen.length === 0 || overflow}
            onClick={() => {
              onAdd(
                chosen.map((row) => copyTask(row, week, target)),
                chosen.map((row) => copyKey(row.id, target)),
              );
              setSelected([]);
            }}
          >
            {t("planning_add_selected", { count: chosen.length })}
          </Button>
        </>
      )}
    </section>
  );
}
