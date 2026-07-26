"use client";

import type { PlanTaskDto } from "@mentor/types";
import Check from "lucide-react/dist/esm/icons/check.mjs";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buildStudySessionHrefFromPlanTask } from "@/lib/plan-study-session-link";
import { PlanTaskMenu } from "./plan-task-menu";

export function PlanTaskRow({
  task,
  busy,
  readOnly,
  onToggle,
  onEdit,
  onDelete,
  dense,
}: {
  task: PlanTaskDto;
  busy?: boolean;
  readOnly?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  dense?: boolean;
}) {
  const t = useTranslations("plan");
  const done = task.status === "DONE";

  return (
    <div
      className={`group flex items-center gap-2 border-b last:border-b-0 ${
        dense
          ? "min-h-[48px] py-2.5 max-lg:min-h-[40px] max-lg:gap-1.5 max-lg:py-1.5"
          : "min-h-[56px] py-3"
      }`}
      style={{
        borderColor: "color-mix(in srgb, var(--color-main) 10%, transparent)",
      }}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={task.title}
        disabled={busy || readOnly}
        onClick={onToggle}
        className={`flex shrink-0 items-center justify-center rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40 motion-reduce:transition-none ${
          dense
            ? "min-h-11 min-w-11 max-lg:min-h-9 max-lg:min-w-9"
            : "min-h-11 min-w-11"
        }`}
      >
        <span
          aria-hidden
          className={`flex items-center justify-center rounded-[6px] border-2 transition-colors motion-reduce:transition-none ${
            dense ? "h-6 w-6 max-lg:h-5 max-lg:w-5" : "h-6 w-6"
          }`}
          style={{
            borderColor: done ? "var(--color-progress)" : "var(--color-secondary)",
            backgroundColor: done ? "var(--color-progress)" : "transparent",
          }}
        >
          {done ? (
            <Check
              size={dense ? 12 : 14}
              color="#fff"
              strokeWidth={3}
              aria-hidden
            />
          ) : null}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <span
          className={`block ${dense ? "text-base max-lg:text-sm" : "text-base"} ${done ? "line-through opacity-70" : "font-medium"}`}
          style={{
            color: done ? "var(--color-secondary)" : "var(--color-body)",
          }}
        >
          {task.title}
        </span>
        <div
          className={`flex flex-wrap items-center gap-2 ${dense ? "mt-1 max-lg:mt-0.5 max-lg:gap-1.5" : "mt-1"}`}
        >
          {task.subject ? (
            <span
              className={`font-bold uppercase tracking-wide ${dense ? "text-[10px] max-lg:text-[9px]" : "text-[10px]"}`}
              style={{
                color: "var(--color-chip-text)",
                fontFamily: "var(--font-body)",
              }}
            >
              {task.subject}
            </span>
          ) : null}
          {!done && !readOnly ? (
            <Link
              href={buildStudySessionHrefFromPlanTask(task)}
              className={`font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 ${dense ? "text-xs max-lg:text-[11px]" : "text-xs"}`}
              style={{ color: "var(--color-progress)" }}
            >
              {t("start_session")} →
            </Link>
          ) : null}
        </div>
      </div>

      {!readOnly ? (
        <PlanTaskMenu
          taskTitle={task.title}
          disabled={busy}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ) : null}
    </div>
  );
}
