"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";

export type NotebookIndexFilterChip = {
  key: string;
  label: string;
  onClear: () => void;
};

export function NotebookIndexFilterChips({
  chips,
  onClearAll,
}: {
  chips: NotebookIndexFilterChip[];
  onClearAll: () => void;
}) {
  const t = useTranslations("notebook");
  if (chips.length === 0) return null;

  return (
    <div
      className="flex flex-col gap-2 rounded-[var(--radius-card)] border p-2"
      style={{ borderColor: "var(--color-border)" }}
    >
      <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
        {t("index_filters_active")}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className="flex min-h-11 items-center gap-1 rounded-full px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{
              color: "var(--color-main)",
              backgroundColor: "var(--color-surface-container)",
            }}
            aria-label={t("index_filter_clear_one", { filter: chip.label })}
            onClick={chip.onClear}
          >
            <span>{chip.label}</span>
            <X aria-hidden size={14} />
          </button>
        ))}
      </div>
      <button
        type="button"
        className="min-h-11 self-end px-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: "var(--color-btn)" }}
        onClick={onClearAll}
      >
        {t("index_filters_clear_all")}
      </button>
    </div>
  );
}
