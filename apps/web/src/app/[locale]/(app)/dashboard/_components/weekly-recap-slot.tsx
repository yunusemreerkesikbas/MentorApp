"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import type { TodayPanelResponse } from "@mentor/types";
import { WeeklyRecapTeaser } from "@/components/weekly-recap-teaser";
import {
  getWeeklyRecapTeaserState,
  type WeeklyRecapTeaserState,
} from "@/lib/weekly-recap";

const getServerSnapshot = (): WeeklyRecapTeaserState => "hidden";

function subscribeStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

/**
 * "Haftanın hikâyesi" — the coral recap banner, unchanged. It shows while last week's recap is new,
 * then turns into a replay card once opened (localStorage), instead of disappearing.
 */
export function WeeklyRecapSlot({ data }: { data: TodayPanelResponse }) {
  const period = data.weeklyRecapPeriod;
  const startDate = period?.startDate ?? null;
  const status = period?.status ?? null;
  const [openedStartDate, setOpenedStartDate] = useState<string | null>(null);
  const stored = useSyncExternalStore(
    subscribeStorage,
    useCallback(
      () =>
        startDate != null && status != null
          ? getWeeklyRecapTeaserState(window.localStorage, startDate, status)
          : "hidden",
      [startDate, status],
    ),
    getServerSnapshot,
  );
  const state = openedStartDate === startDate && stored === "new" ? "replay" : stored;

  if (!period || state === "hidden") return null;

  return (
    <WeeklyRecapTeaser
      period={period}
      status={period.status}
      source="dashboard"
      examId={period.examId}
      examType={data.countdown?.examType}
      compact
      viewState={state === "replay" ? "replay" : "new"}
      onOpen={() => setOpenedStartDate(period.startDate)}
    />
  );
}
