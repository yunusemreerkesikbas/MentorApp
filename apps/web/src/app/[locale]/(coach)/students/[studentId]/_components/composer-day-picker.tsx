"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { dayCount, type DayCount } from "./planning-state";

/** A phone-width chip: "2", "+1", "2+1". */
function countDigits(count: DayCount): string {
  switch (count.kind) {
    case "loading":
      return "…";
    case "none":
      return "";
    case "existing":
      return String(count.existing);
    case "drafts":
      return `+${count.drafts}`;
    case "both":
      return `${count.existing}+${count.drafts}`;
  }
}

/**
 * The seven day chips of the week composer. The group keeps its "Gün seç" label and holds only the
 * days, so "the third day" is still `getByRole("group").getByRole("button").nth(2)`.
 */
export function ComposerDayPicker({
  days,
  selectedDate,
  counts,
  existingCounts,
  onSelect,
}: {
  days: readonly string[];
  selectedDate: string;
  counts: ReadonlyMap<string, number>;
  existingCounts?: ReadonlyMap<string, number>;
  onSelect: (day: string) => void;
}) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const countText = (count: DayCount) => {
    switch (count.kind) {
      case "loading":
        return "…";
      case "none":
        return "";
      case "existing":
        return t("planning_count_tasks", { count: count.existing });
      case "drafts":
        return t("planning_count_drafts", { count: count.drafts });
      case "both":
        return t("planning_count_both", { existing: count.existing, drafts: count.drafts });
    }
  };
  const weekdayFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "short" }),
    [locale],
  );
  const longFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [locale],
  );

  return (
    <div
      role="group"
      aria-label={t("assign_week_pick")}
      className="grid grid-cols-7 gap-1.5"
    >
      {days.map((day) => {
        const date = new Date(`${day}T00:00:00`);
        const count = counts.get(day) ?? 0;
        const active = day === selectedDate;
        return (
          <button
            key={day}
            type="button"
            aria-pressed={active}
            aria-label={`${longFormat.format(date)} · ${t("planning_day_counts", { existing: existingCounts?.get(day) ?? "…", drafts: count })}`}
            // The panel opens on the week: focus starts on the day being planned.
            data-autofocus={active ? "" : undefined}
            onClick={() => onSelect(day)}
            className={`flex min-h-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[var(--radius-card)] border py-2 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none ${
              active
                ? "border-[var(--play-selected)] bg-[var(--play-selected)] text-[var(--play-selected-ink)] shadow-[inset_0_0_0_2px_var(--play-cta)]"
                : "border-[var(--play-line)] bg-[var(--color-surface)] text-[var(--color-main)] hover:bg-[var(--color-surface-container)]"
            }`}
          >
            <span
              className={`text-xs font-extrabold ${active ? "" : "text-[var(--color-secondary)]"}`}
            >
              {weekdayFormat.format(date)}
            </span>
            <span className="text-base font-extrabold tabular-nums">
              {date.getDate()}
            </span>
            {/* The sentence is in the button's name; the chip shows it in words, or in numbers on a phone. */}
            <span
              aria-hidden
              className={`hidden h-4 max-w-full truncate px-0.5 text-micro font-extrabold tabular-nums sm:block ${active ? "" : "text-[var(--color-secondary)]"}`}
            >
              {countText(dayCount(existingCounts?.get(day), count))}
            </span>
            <span
              aria-hidden
              className={`h-4 text-micro font-extrabold tabular-nums sm:hidden ${active ? "" : "text-[var(--color-secondary)]"}`}
            >
              {countDigits(dayCount(existingCounts?.get(day), count))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
