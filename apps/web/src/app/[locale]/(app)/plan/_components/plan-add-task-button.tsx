"use client";
import { Plus } from "lucide-react";

import { useTranslations } from "next-intl";

/**
 * Compact “+” chip — soft border/surface for affordance; slides open
 * “Görev ekle” on hover/focus (label expands toward the left).
 *
 * The button is absolutely placed inside a fixed 36px slot so the expanding label OVERLAYS its
 * surroundings instead of widening the row. Without that, every heading it sits next to (narrow
 * rails especially) reflows and jumps on hover.
 */
export function PlanAddTaskButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations("plan");

  return (
    <span className="relative flex size-9 shrink-0">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={t("add_task_aria")}
        className="group absolute top-0 right-0 z-10 flex h-9 flex-row-reverse items-center overflow-hidden rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--color-border)_70%,transparent)] bg-[color-mix(in_srgb,var(--color-surface)_70%,transparent)] transition-[background-color,border-color,box-shadow] duration-200 ease-out hover:border-[var(--color-border)] hover:bg-[var(--color-surface)] hover:shadow-[var(--shadow-card)] focus-visible:border-[var(--color-border)] focus-visible:bg-[var(--color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:shadow-[var(--shadow-card)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:shadow-none"
        style={{ color: "var(--color-main)" }}
      >
        <span className="flex size-9 shrink-0 items-center justify-center cursor-pointer">
          <Plus
            size={20}
            strokeWidth={2.5}
            aria-hidden
            className="transition-transform duration-200 ease-out group-hover:rotate-90 group-focus-visible:rotate-90 motion-reduce:transition-none motion-reduce:group-hover:rotate-0 motion-reduce:group-focus-visible:rotate-0"
          />
        </span>
        <span
          className="max-w-0 overflow-hidden whitespace-nowrap pl-0 text-sm font-medium opacity-0 transition-[max-width,opacity,padding] duration-200 ease-out group-hover:max-w-[7.5rem] group-hover:pl-2.5 group-hover:opacity-100 group-focus-visible:max-w-[7.5rem] group-focus-visible:pl-2.5 group-focus-visible:opacity-100 motion-reduce:transition-none"
          style={{ fontFamily: "var(--font-body)" }}
          aria-hidden
        >
          {t("add_task")}
        </span>
      </button>
    </span>
  );
}
