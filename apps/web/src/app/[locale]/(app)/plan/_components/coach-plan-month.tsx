"use client";

import type { CoachPlanItemDto } from "@mentor/types";
import { useLocale, useTranslations } from "next-intl";
import {
  itemsForCoachPlanDay,
  uniqueStudentAvatars,
} from "@/lib/coach-plan-calendar";
import { CoachPlanAvatarStack } from "./coach-plan-avatar-stack";
import { CoachPlanItemCard, coachPlanItemId } from "./coach-plan-item-card";

export function CoachPlanMonth({
  days,
  month,
  items,
  selectedDate,
  selectedId,
  onSelectDate,
  onSelectItem,
}: {
  days: readonly string[];
  month: string;
  items: readonly CoachPlanItemDto[];
  selectedDate: string;
  selectedId: string | null;
  onSelectDate: (date: string) => void;
  onSelectItem: (item: CoachPlanItemDto) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("coachPlan");
  const selectedItems = itemsForCoachPlanDay(items, selectedDate);

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-x-auto rounded-[var(--radius-card)] border"
        style={{ borderColor: "var(--color-border)" }}>
        <div className="grid min-w-3xl grid-cols-7">
          {days.map((day) => {
            const dayItems = itemsForCoachPlanDay(items, day);
            const taskCount = dayItems.filter((item) => item.kind === "TASK").length;
            const eventCount = dayItems.length - taskCount;
            const avatars = uniqueStudentAvatars(dayItems, 3);
            const names = avatars.students.map((student) => student.studentDisplayName).join(", ");
            return (
              <button
                key={day}
                type="button"
                onClick={() => onSelectDate(day)}
                aria-pressed={selectedDate === day}
                aria-label={t("open_day", {
                  date: formatDay(day, locale, "long"),
                  count: dayItems.length,
                })}
                className="flex min-h-32 flex-col gap-2 border-b border-r p-2 text-left focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{
                  backgroundColor: selectedDate === day
                    ? "var(--color-accent-soft)"
                    : "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  opacity: day.startsWith(month) ? 1 : 0.64,
                }}
              >
                <span className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
                  {formatDay(day, locale, "numeric")}
                </span>
                {dayItems.length > 0 ? (
                  <>
                    <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
                      {taskCount > 0 && t("task_count", { count: taskCount })}
                      {taskCount > 0 && eventCount > 0 ? " · " : ""}
                      {eventCount > 0 && t("event_count", { count: eventCount })}
                    </span>
                    <CoachPlanAvatarStack
                      people={avatars.students}
                      overflow={avatars.overflow}
                      label={t("participants_named", { names })}
                    />
                  </>
                ) : (
                  <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
                    {t("day_empty_short")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <section aria-labelledby="coach-plan-selected-day">
        <h2
          id="coach-plan-selected-day"
          className="mb-3 text-lg font-semibold capitalize"
          style={{ color: "var(--color-main)" }}
        >
          {formatDay(selectedDate, locale, "long")}
        </h2>
        {selectedItems.length === 0 ? (
          <p
            className="rounded-[var(--radius-card)] border p-4"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-secondary)",
            }}
          >
            {t("selected_day_empty")}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {selectedItems.map((item) => (
              <CoachPlanItemCard
                key={`${item.kind}:${coachPlanItemId(item)}`}
                item={item}
                selected={selectedId === coachPlanItemId(item)}
                onSelect={onSelectItem}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatDay(
  day: string,
  locale: string,
  detail: "numeric" | "long",
): string {
  return new Intl.DateTimeFormat(
    locale,
    detail === "numeric"
      ? { day: "numeric" }
      : { weekday: "long", day: "numeric", month: "long" },
  ).format(new Date(`${day}T12:00:00Z`));
}
