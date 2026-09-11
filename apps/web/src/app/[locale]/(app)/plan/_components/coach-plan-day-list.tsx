"use client";

import { Plus } from "lucide-react";
import type { CoachPlanItemDto } from "@mentor/types";
import { SectionHeading } from "@mentor/ui";
import { useLocale, useTranslations } from "next-intl";
import type { PlanCalendarItem } from "@/lib/plan-calendar-item";
import { CoachPlanAvatarStack } from "./coach-plan-avatar-stack";
import { formatDateLabel, formatTimeRange } from "./plan-utils";

export function CoachPlanDayList({
  selectedDate,
  items,
  onOpen,
  onAdd,
}: {
  selectedDate: string;
  items: readonly PlanCalendarItem<CoachPlanItemDto>[];
  onOpen: (item: CoachPlanItemDto, trigger: HTMLButtonElement) => void;
  onAdd: () => void;
}) {
  const t = useTranslations("coachPlan");
  const locale = useLocale();
  const dayHeading = formatDateLabel(selectedDate, locale, t("today"), {
    alwaysFull: true,
  });

  return (
    <div className="flex min-w-0 flex-col">
      <SectionHeading
        action={
          <button
            type="button"
            onClick={onAdd}
            aria-label={t("calendar_add_on", { date: dayHeading })}
            className="flex size-9 items-center justify-center rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2"
            style={{ color: "var(--color-main)" }}
          >
            <Plus size={20} strokeWidth={2.5} aria-hidden />
          </button>
        }
      >
        {dayHeading}
      </SectionHeading>
      {items.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("selected_day_empty")}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {items.map((item) => {
            const people =
              item.source.kind === "TASK"
                ? item.source.task.participants
                : item.source.event.attendees;
            const range = formatTimeRange(item.startTime, item.endTime);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={(event) => onOpen(item.source, event.currentTarget)}
                  aria-label={`${item.title} · ${t(item.source.kind === "TASK" ? "type_task" : "type_event")}`}
                  className="flex w-full min-h-11 items-start gap-3 border-b py-2 text-left last:border-b-0 focus-visible:outline-none focus-visible:ring-2"
                  style={{
                    borderColor: "color-mix(in srgb, var(--color-border) 70%, transparent)",
                  }}
                >
                  <span
                    aria-hidden
                    className="mt-1.5 h-4 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color.bar }}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={`truncate text-sm font-semibold ${item.muted ? "line-through opacity-70" : ""}`}
                      style={{ color: "var(--color-main)" }}
                    >
                      {item.title}
                    </span>
                    <span className="truncate text-xs" style={{ color: "var(--color-secondary)" }}>
                      {[range ?? t("all_day"), item.meta].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {people.length > 0 ? (
                    <CoachPlanAvatarStack
                      people={people.slice(0, 3)}
                      overflow={Math.max(0, people.length - 3)}
                      size={24}
                      label={t("participants_named", {
                        names: people.map((person) => person.studentDisplayName).join(", "),
                      })}
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
