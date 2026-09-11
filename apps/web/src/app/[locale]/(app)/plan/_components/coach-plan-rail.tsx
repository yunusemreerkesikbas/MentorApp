"use client";

import type { CoachPlanItemDto, MentorshipRosterRowDto } from "@mentor/types";
import { Card } from "@mentor/ui";
import type { PlanCalendarItem } from "@/lib/plan-calendar-item";
import { PlanWeekMiniCalendar } from "./plan-week-mini-calendar";
import { CoachPlanDayList } from "./coach-plan-day-list";
import { CoachPlanStudentFilter } from "./coach-plan-student-filter";

export function CoachPlanRail({
  selectedDate,
  weekStartDate,
  roster,
  studentId,
  dayItems,
  loadMarkedDates,
  onDateChange,
  onStudent,
  onOpen,
  onAdd,
}: {
  selectedDate: string;
  weekStartDate: string;
  roster: readonly MentorshipRosterRowDto[];
  studentId: string | null;
  dayItems: readonly PlanCalendarItem<CoachPlanItemDto>[];
  loadMarkedDates: (from: string, to: string) => Promise<string[]>;
  onDateChange: (iso: string) => void;
  onStudent: (studentId: string | null) => void;
  onOpen: (item: CoachPlanItemDto, trigger: HTMLButtonElement) => void;
  onAdd: () => void;
}) {
  return (
    <>
      <PlanWeekMiniCalendar
        selectedDate={selectedDate}
        weekStartDate={weekStartDate}
        loadMarkedDates={loadMarkedDates}
        onDateChange={onDateChange}
      />
      <CoachPlanStudentFilter
        roster={roster}
        studentId={studentId}
        onStudent={onStudent}
      />
      <Card className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <CoachPlanDayList
          selectedDate={selectedDate}
          items={dayItems}
          onOpen={onOpen}
          onAdd={onAdd}
        />
      </Card>
    </>
  );
}
