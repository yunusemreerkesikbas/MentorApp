"use client";

import { useEffect, useState } from "react";
import type { PlanEventDto } from "@mentor/types";
import { groupPlanEventsByDate, listPlanEventsForRange } from "@/lib/plan-events";

/**
 * The student's events over a range, keyed by date. Best-effort like the holidays: the plan works
 * without them, so a failed read shows none instead of an error, and the notification that
 * announced a meeting still carries its title and time.
 */
export function usePlanEvents(from: string, to: string): Record<string, PlanEventDto[]> {
  const [eventsByDate, setEventsByDate] = useState<Record<string, PlanEventDto[]>>({});

  useEffect(() => {
    let active = true;
    listPlanEventsForRange(from, to)
      .then((events) => {
        if (active) setEventsByDate(groupPlanEventsByDate(events));
      })
      .catch(() => {
        if (active) setEventsByDate({});
      });
    return () => {
      active = false;
    };
  }, [from, to]);

  return eventsByDate;
}
