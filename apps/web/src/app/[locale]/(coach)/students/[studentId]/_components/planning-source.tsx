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
      <h3 className="font-semibold">{t("planning_source")}</h3>
      <div className="flex flex-wrap gap-2">
        {[shiftDate(current, -7), current].map((value, i) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={week === value ? "soft" : "ghost"}
            onClick={() => {
              setWeek(value);
              setSelected([]);
            }}
          >
            {t(i === 0 ? "planning_last_week" : "assign_week_this")}
          </Button>
        ))}
      </div>
      <p>
        {week} – {shiftDate(week, 6)}
      </p>
      <div className="flex flex-wrap gap-2">
        {["ALL", "PENDING", "DONE"].map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={filter === value ? "soft" : "ghost"}
            onClick={() => setFilter(value)}
          >
            {t(`planning_filter_${value}`)}
          </Button>
        ))}
      </div>
      {data.error ? (
        <div role="alert">
          <p>{data.error}</p>
          <Button type="button" onClick={data.retry}>
            {t("planning_retry")}
          </Button>
        </div>
      ) : data.rows === null ? (
        <div role="status" aria-label={t("loading")}>
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setSelected((prev) => [
                ...new Set([...prev, ...available.map((r) => r.id)]),
              ])
            }
          >
            {t("planning_select_visible")}
          </Button>
          {visible.length === 0 && <p>{t("planning_empty")}</p>}
          {visible.map((row) => (
            <label
              key={row.id}
              className="flex min-h-11 items-start gap-3 py-2"
            >
              <input
                type="checkbox"
                className="mt-1 size-5"
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
              <span>
                {row.title}
                <span className="block text-sm text-[var(--color-secondary)]">
                  {[
                    row.taskDate,
                    row.subject,
                    row.topic,
                    t(
                      row.status === "DONE"
                        ? "planning_filter_DONE"
                        : "planning_filter_PENDING",
                    ),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </label>
          ))}
          {overflow && (
            <p role="alert">{t("planning_capacity", { max: MAX_DRAFTS })}</p>
          )}
          <Button
            type="button"
            size="sm"
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
