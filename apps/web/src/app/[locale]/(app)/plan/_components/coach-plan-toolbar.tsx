"use client";

import { CalendarPlus, ListPlus } from "lucide-react";
import { Button } from "@mentor/ui";
import { useTranslations } from "next-intl";

export function CoachPlanToolbar({
  onNewTask,
  onNewEvent,
}: {
  onNewTask: (trigger: HTMLButtonElement) => void;
  onNewEvent: (trigger: HTMLButtonElement) => void;
}) {
  const t = useTranslations("coachPlan");

  return (
    <header className="flex shrink-0 flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-main)" }}>
          {t("title")}
        </h1>
        <p className="mt-1" style={{ color: "var(--color-secondary)" }}>
          {t("subtitle")}
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={(event) => onNewTask(event.currentTarget)}>
          <ListPlus aria-hidden size={18} />
          {t("new_task")}
        </Button>
        <Button type="button" variant="secondary" onClick={(event) => onNewEvent(event.currentTarget)}>
          <CalendarPlus aria-hidden size={18} />
          {t("new_event")}
        </Button>
      </div>
    </header>
  );
}
