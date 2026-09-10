"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { MentorshipRosterRowDto } from "@mentor/types";
import {
  coachPlanQueryKey,
  coachPlanQueryTransition,
} from "@/lib/coach-plan-calendar";
import { todayInIstanbul } from "@/lib/date-time";
import { fetchActiveRoster } from "@/lib/mentorship";
import { CoachPlanCalendarShell } from "./coach-plan-calendar-shell";

type RosterStatus = "loading" | "ready" | "error";

/** Keeps roster lifecycle stable while query-keyed calendar state follows same-route deep links. */
export function CoachPlanShell() {
  const searchParams = useSearchParams();
  const query = {
    date: searchParams.get("date"),
    event: searchParams.get("event"),
  };
  const transition = coachPlanQueryTransition(query);
  const initialDate = transition?.selectedDate ?? todayInIstanbul();
  const initialEventId = transition?.eventId ?? null;
  const queryKey = coachPlanQueryKey(query);
  const [roster, setRoster] = useState<MentorshipRosterRowDto[]>([]);
  const [rosterStatus, setRosterStatus] = useState<RosterStatus>("loading");
  const [rosterReload, setRosterReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void fetchActiveRoster(controller.signal)
      .then((items) => {
        if (!active) return;
        setRoster(items);
        setRosterStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        setRosterStatus("error");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [rosterReload]);

  return (
    <CoachPlanCalendarShell
      key={queryKey}
      initialDate={initialDate}
      initialEventId={initialEventId}
      roster={roster}
      rosterLoading={rosterStatus === "loading"}
      rosterError={rosterStatus === "error"}
      onRetryRoster={() => {
        setRosterStatus("loading");
        setRosterReload((value) => value + 1);
      }}
    />
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}
