"use client";

import type { CoachPlanItemDto } from "@mentor/types";
import { useTranslations } from "next-intl";
import { CoachPlanAvatarStack } from "./coach-plan-avatar-stack";

export function coachPlanItemId(item: CoachPlanItemDto): string {
  return item.kind === "TASK" ? item.task.id : item.event.id;
}

export function CoachPlanItemCard({
  item,
  selected,
  onSelect,
}: {
  item: CoachPlanItemDto;
  selected: boolean;
  onSelect: (item: CoachPlanItemDto) => void;
}) {
  const t = useTranslations("coachPlan");
  const data = item.kind === "TASK" ? item.task : item.event;
  const people = item.kind === "TASK" ? item.task.participants : item.event.attendees;
  const visible = people.slice(0, 3);
  const time = data.startTime
    ? data.endTime
      ? `${data.startTime}–${data.endTime}`
      : data.startTime
    : t("all_day");
  const peopleLabel = people.map((person) => person.studentDisplayName).join(", ");

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-pressed={selected}
      className="flex min-h-11 w-full flex-col gap-2 rounded-[var(--radius-card)] border p-3 text-left shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      style={{
        backgroundColor: selected
          ? "var(--color-accent-soft)"
          : "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="flex flex-wrap gap-1.5">
          <span
            className="rounded-[var(--radius-card)] px-2 py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: item.kind === "TASK"
                ? "var(--color-chip)"
                : "var(--color-accent-soft)",
              color: item.kind === "TASK"
                ? "var(--color-chip-text)"
                : "var(--color-main)",
            }}
          >
            {t(item.kind === "TASK" ? "type_task" : "type_event")}
          </span>
          <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
            {t(people.length === 0 ? "personal" : "shared")}
          </span>
        </span>
        <span className="text-xs tabular-nums" style={{ color: "var(--color-secondary)" }}>
          {time}
        </span>
      </span>
      <span className="font-semibold" style={{ color: "var(--color-main)" }}>
        {data.title}
      </span>
      {people.length > 0 && (
        <CoachPlanAvatarStack
          people={visible}
          overflow={people.length - visible.length}
          label={t("participants_named", { names: peopleLabel })}
        />
      )}
    </button>
  );
}
