"use client";

import type { PlanTaskDto } from "@mentor/types";
import { Chip } from "@mentor/ui";
import Check from "lucide-react/dist/esm/icons/check.mjs";
import EllipsisVertical from "lucide-react/dist/esm/icons/ellipsis-vertical.mjs";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function PlanTaskRow({
  task,
  busy,
  readOnly,
  onToggle,
  onMenu,
  dense,
}: {
  task: PlanTaskDto;
  busy?: boolean;
  readOnly?: boolean;
  onToggle: () => void;
  onMenu: () => void;
  dense?: boolean;
}) {
  const t = useTranslations("plan");
  const done = task.status === "DONE";

  return (
    <div
      className={`group flex items-center gap-2 border-b border-white/30 last:border-b-0 ${dense ? "min-h-[48px] py-2" : "min-h-[56px] py-2"}`}
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
            <Chip className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              {task.subject}
            </Chip>
          ) : null}
          {!done && !readOnly ? (
            <Link
              href="/seans"
              className="text-xs font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
              style={{ color: "var(--color-progress)" }}
            >
              {t("start_session")} →
            </Link>
          ) : null}
        </div>
      </div>

      {!readOnly ? (
        <button
          type="button"
          onClick={onMenu}
          disabled={busy}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] transition-colors hover:bg-white/60 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100 motion-reduce:transition-none"
          style={{ color: "var(--color-secondary)" }}
          aria-label={t("task_menu_aria", { title: task.title })}
        >
          <EllipsisVertical size={20} strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
