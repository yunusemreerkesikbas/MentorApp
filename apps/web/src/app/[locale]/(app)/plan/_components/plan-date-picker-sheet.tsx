"use client";

import { forwardRef, useEffect, useState } from "react";
import { DatePickerSheet, type DatePickerSheetHandle, isoToLocalDate } from "@/components/date-picker-sheet";
import { listPlanTaskCalendarDates } from "@/lib/plan-tasks";
import { monthIsoBounds } from "./plan-utils";

export type PlanDatePickerSheetHandle = DatePickerSheetHandle;

export type PlanDatePickerSheetProps = {
  defaultValue: string;
  seedPlannedDates?: string[];
};

/** Plan-specific date sheet: shared picker plus calendar-date dots. */
export const PlanDatePickerSheet = forwardRef<
  PlanDatePickerSheetHandle,
  PlanDatePickerSheetProps
>(function PlanDatePickerSheet({ defaultValue, seedPlannedDates = [] }, ref) {
  const [plannedDates, setPlannedDates] = useState<Set<string>>(
    () => new Set(seedPlannedDates),
  );

  useEffect(() => {
    // Merge freshly-seeded planned dates into local state — deliberate external-sync, not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlannedDates((prev) => new Set([...prev, ...seedPlannedDates]));
  }, [seedPlannedDates]);

  useEffect(() => {
    const start = isoToLocalDate(defaultValue);
    loadMonth(start.getFullYear(), start.getMonth(), setPlannedDates);
  }, [defaultValue]);

  return (
    <DatePickerSheet
      ref={ref}
      defaultValue={defaultValue}
      markedDates={[...plannedDates]}
      onMonthChange={(year, monthIndex) => loadMonth(year, monthIndex, setPlannedDates)}
    />
  );
});

function loadMonth(
  year: number,
  monthIndex: number,
  setPlannedDates: (dates: Set<string>) => void,
) {
  const { from, to } = monthIsoBounds(year, monthIndex);
  listPlanTaskCalendarDates(from, to)
    .then((dates) => setPlannedDates(new Set(dates)))
    .catch(() => undefined);
}
