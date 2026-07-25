"use client";

import type { PlanTaskDto } from "@mentor/types";
import { Card } from "@mentor/ui";
import { PlanWeekStrip } from "./plan-week-strip";

/** Mobile Hafta — week navigation card (task list lives in PlanWeekView). */
export function PlanWeekNavCard({
  weekStartDate,
  selectedDate,
  weekTasks,
  onWeekChange,
  onDateChange,
}: {
  weekStartDate: string;
  selectedDate: string;
  weekTasks: Record<string, PlanTaskDto[]>;
  onWeekChange: (weekStart: string) => void;
  onDateChange: (iso: string) => void;
}) {
  return (
    <Card className="!p-4 lg:hidden">
      <PlanWeekStrip
        weekStartDate={weekStartDate}
        selectedDate={selectedDate}
        weekTasks={weekTasks}
        onWeekChange={onWeekChange}
        onDateChange={onDateChange}
      />
    </Card>
  );
}
