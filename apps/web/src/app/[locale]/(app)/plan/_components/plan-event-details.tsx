"use client";

import type { PlanTaskDto } from "@mentor/types";
import Clock from "lucide-react/dist/esm/icons/clock.mjs";
import Pencil from "lucide-react/dist/esm/icons/pencil.mjs";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.mjs";
import { useLocale, useTranslations } from "next-intl";
import { planEventColor } from "@/lib/plan-event-colors";
import { formatDateLabel, formatTimeRange } from "./plan-utils";

/**
 * Event details sheet body (mobile tap target for a calendar event).
 *
 * The reference design's Repeat / Reminders rows have no counterpart here — recurrence and
 * reminders are backlog, and showing dead rows would promise features we don't have. The rows
 * below are the fields a plan task actually carries.
 */
export function PlanEventDetails({
  task,
  readOnly,
  onEdit,
  onDelete,
}: {
  task: PlanTaskDto;
  readOnly?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const color = planEventColor(task.subject);
  const range = formatTimeRange(task.startTime, task.endTime);
  const when = `${formatDateLabel(task.taskDate, locale, t("today"), { alwaysFull: true })}, ${range ?? t("all_day")}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary banner — the event's own color, same swatch as its calendar chip. */}
      <div
        className="flex flex-col gap-2 rounded-[var(--radius-card)] p-4"
        style={{ backgroundColor: color.bg }}
      >
        <p
          className={`text-lg font-bold leading-snug ${task.status === "DONE" ? "line-through opacity-70" : ""}`}
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {task.title}
        </p>
        <p
          className="flex items-center gap-2 text-sm"
          style={{ color: "var(--color-body)" }}
        >
          <Clock size={16} strokeWidth={2} aria-hidden />
          {when}
        </p>
      </div>

      <dl className="flex flex-col">
        <DetailRow label={t("subject")} value={task.subject ?? "—"} />
        <DetailRow
          label={t("event_status")}
          value={t(task.status === "DONE" ? "event_status_done" : "event_status_pending")}
        />
        {task.description ? (
          <DetailRow label={t("description")} value={task.description} multiline />
        ) : null}
      </dl>

      {!readOnly ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-card)] border text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
            style={{
              borderColor: "color-mix(in srgb, var(--color-main) 15%, transparent)",
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            <Pencil size={16} strokeWidth={2} aria-hidden />
            {t("task_action_edit")}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-card)] border text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
            style={{
              borderColor: "color-mix(in srgb, var(--color-danger) 30%, transparent)",
              color: "var(--color-danger)",
              fontFamily: "var(--font-heading)",
            }}
          >
            <Trash2 size={16} strokeWidth={2} aria-hidden />
            {t("task_action_delete")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div
      className={`flex gap-4 border-b py-3 last:border-b-0 ${multiline ? "flex-col gap-1" : "items-center justify-between"}`}
      style={{ borderColor: "color-mix(in srgb, var(--color-main) 8%, transparent)" }}
    >
      <dt className="shrink-0 text-sm" style={{ color: "var(--color-secondary)" }}>
        {label}
      </dt>
      <dd
        className={`text-sm ${multiline ? "" : "min-w-0 truncate text-right font-medium"}`}
        style={{ color: "var(--color-main)" }}
      >
        {value}
      </dd>
    </div>
  );
}
