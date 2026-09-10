"use client";

import type { CoachPlanItemDto } from "@mentor/types";
import { useLocale, useTranslations } from "next-intl";
import { itemsForCoachPlanDay } from "@/lib/coach-plan-calendar";
import {
  CoachPlanItemCard,
  coachPlanItemId,
  type CoachPlanItemSelect,
} from "./coach-plan-item-card";

export function CoachPlanWeek({
  days,
  items,
  selectedDate,
  selectedId,
  onSelectDate,
  onSelect,
}: {
  days: readonly string[];
  items: readonly CoachPlanItemDto[];
  selectedDate: string;
  selectedId: string | null;
  onSelectDate: (date: string) => void;
  onSelect: CoachPlanItemSelect;
}) {
  const locale = useLocale();
  const t = useTranslations("coachPlan");

  return (
    <>
      <div className="hidden grid-cols-7 gap-2 lg:grid">
        {days.map((day) => (
          <DayColumn
            key={day}
            day={day}
            locale={locale}
            dayItems={itemsForCoachPlanDay(items, day)}
            selected={selectedDate === day}
            selectedId={selectedId}
            onSelectDate={onSelectDate}
            onSelect={onSelect}
            emptyLabel={t("day_empty")}
            selectLabel={t("select_date", { date: day })}
          />
        ))}
      </div>
      <div className="flex flex-col gap-4 lg:hidden">
        {days.map((day) => (
          <DayColumn
            key={day}
            day={day}
            locale={locale}
            dayItems={itemsForCoachPlanDay(items, day)}
            selected={selectedDate === day}
            selectedId={selectedId}
            onSelectDate={onSelectDate}
            onSelect={onSelect}
            emptyLabel={t("day_empty")}
            selectLabel={t("select_date", { date: day })}
            mobile
          />
        ))}
      </div>
    </>
  );
}

function DayColumn({
  day,
  locale,
  dayItems,
  selected,
  selectedId,
  onSelectDate,
  onSelect,
  emptyLabel,
  selectLabel,
  mobile = false,
}: {
  day: string;
  locale: string;
  dayItems: CoachPlanItemDto[];
  selected: boolean;
  selectedId: string | null;
  onSelectDate: (date: string) => void;
  onSelect: CoachPlanItemSelect;
  emptyLabel: string;
  selectLabel: string;
  mobile?: boolean;
}) {
  const label = new Intl.DateTimeFormat(locale, {
    weekday: mobile ? "long" : "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${day}T12:00:00Z`));

  return (
    <section
      className="min-w-0 rounded-[var(--radius-card)] border p-2"
      style={{
        backgroundColor: "var(--color-surface-translucent)",
        borderColor: "var(--color-border)",
      }}
    >
      <h2 className="mb-2">
        <button
          type="button"
          aria-label={selectLabel}
          aria-pressed={selected}
          onClick={() => onSelectDate(day)}
          className="flex min-h-11 w-full items-center rounded-[var(--radius-control)] px-2 text-left text-sm font-semibold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{
            color: "var(--color-main)",
            backgroundColor: selected ? "var(--color-soft)" : "transparent",
          }}
        >
          {label}
        </button>
      </h2>
      {dayItems.length === 0 ? (
        <p className="py-3 text-xs" style={{ color: "var(--color-secondary)" }}>
          {emptyLabel}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {dayItems.map((item) => (
            <CoachPlanItemCard
              key={`${item.kind}:${coachPlanItemId(item)}`}
              item={item}
              selected={selectedId === coachPlanItemId(item)}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}
