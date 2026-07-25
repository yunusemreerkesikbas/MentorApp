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
      className={`group flex items-center gap-2 border-b last:border-b-0 ${dense ? "min-h-[48px] py-2.5" : "min-h-[56px] py-3"}`}
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
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40 motion-reduce:transition-none"
      >
        <span
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-[6px] border-2 transition-colors motion-reduce:transition-none"
          style={{
            borderColor: done ? "var(--color-progress)" : "var(--color-secondary)",
            backgroundColor: done ? "var(--color-progress)" : "transparent",
          }}
        >
          {done ? <Check size={14} color="#fff" strokeWidth={3} aria-hidden /> : null}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <span
          className={`block text-base ${done ? "line-through opacity-70" : "font-medium"}`}
          style={{
            color: done ? "var(--color-secondary)" : "var(--color-body)",
          }}
        >
          {task.title}
        </span>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {task.subject ? (
            <span
              className="text-[10px] font-bold uppercase tracking-wide"
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
              className="text-xs font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
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
