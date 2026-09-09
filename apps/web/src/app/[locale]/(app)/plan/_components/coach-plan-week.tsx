"use client";

import type { CoachPlanItemDto } from "@mentor/types";
import { useLocale, useTranslations } from "next-intl";
import { itemsForCoachPlanDay } from "@/lib/coach-plan-calendar";
import { CoachPlanItemCard, coachPlanItemId } from "./coach-plan-item-card";

export function CoachPlanWeek({
  days,
  items,
  selectedId,
  onSelect,
}: {
  days: readonly string[];
  items: readonly CoachPlanItemDto[];
  selectedId: string | null;
  onSelect: (item: CoachPlanItemDto) => void;
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
            selectedId={selectedId}
            onSelect={onSelect}
            emptyLabel={t("day_empty")}
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
            selectedId={selectedId}
            onSelect={onSelect}
            emptyLabel={t("day_empty")}
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
  selectedId,
  onSelect,
  emptyLabel,
  mobile = false,
}: {
  day: string;
  locale: string;
  dayItems: CoachPlanItemDto[];
  selectedId: string | null;
  onSelect: (item: CoachPlanItemDto) => void;
  emptyLabel: string;
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
      <h2
        className="mb-2 text-sm font-semibold capitalize"
        style={{ color: "var(--color-main)" }}
      >
        {label}
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
