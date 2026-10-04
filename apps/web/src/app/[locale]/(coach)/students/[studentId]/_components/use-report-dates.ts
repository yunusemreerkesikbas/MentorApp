"use client";

import { useMemo } from "react";
import { useFormatter } from "next-intl";

/**
 * The student page's calendar days in words: "21–27 Eylül", "14–20 Eyl", "Per 24", "Perşembe 24",
 * "6 Eyl 2026". Every input is a `yyyy-mm-dd` day; it is read at noon UTC, where no browser time
 * zone can push it across midnight.
 */
export function useReportDates() {
  const format = useFormatter();
  return useMemo(() => {
    const at = (day: string) => new Date(`${day}T12:00:00.000Z`);
    return {
      range: (start: string, end: string) =>
        format.dateTimeRange(at(start), at(end), { day: "numeric", month: "long" }),
      /** A table's column head: "14–20 Eyl". */
      rangeShort: (start: string, end: string) =>
        format.dateTimeRange(at(start), at(end), { day: "numeric", month: "short" }),
      shortDay: (day: string) =>
        `${format.dateTime(at(day), { weekday: "short" })} ${at(day).getUTCDate()}`,
      longDay: (day: string) =>
        `${format.dateTime(at(day), { weekday: "long" })} ${at(day).getUTCDate()}`,
      formatDate: (day: string) =>
        format.dateTime(at(day), { day: "numeric", month: "short", year: "numeric" }),
    };
  }, [format]);
}
