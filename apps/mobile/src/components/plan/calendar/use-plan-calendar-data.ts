import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { groupPlanEventsByDate, groupPlanTasksByDate } from "@mentor/core";
import { listPlanEventsForRange, listPlanTasksForRange } from "../../../lib/coaching-api.js";
import { listPublicHolidays } from "../../../lib/content-api.js";
import { boardDays, calendarItemsByDate } from "../../../lib/plan-calendar.js";
import { useAuth } from "../../../providers/auth-provider.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

export function usePlanCalendarData(month: string, enabled: boolean) {
  const { user } = useAuth();
  const t = useTranslations("plan");
  const { palette } = useThemeTokens();
  const days = useMemo(() => boardDays(month), [month]);
  const from = days[0]!;
  const to = days[days.length - 1]!;
  const tasks = useQuery({
    queryKey: ["plan-tasks", "month", month],
    queryFn: async () => {
      const byDate = groupPlanTasksByDate(await listPlanTasksForRange(from, to));
      for (const iso of days) byDate[iso] ??= [];
      return byDate;
    },
    enabled,
  });
  const meetings = useQuery({
    queryKey: ["plan-events", "month", month],
    queryFn: async () => groupPlanEventsByDate(await listPlanEventsForRange(from, to)),
    enabled,
    retry: false,
  });
  const holidays = useQuery({
    queryKey: ["holidays", month],
    queryFn: async () => Object.fromEntries(
      (await listPublicHolidays(from, to)).map((holiday) => [holiday.date, holiday]),
    ),
    enabled,
    retry: false,
    staleTime: 24 * 60 * 60 * 1000,
  });
  const viewerId = user?.id ?? "";
  const eventsByDate = meetings.isError ? undefined : meetings.data;
  const itemsByDate = useMemo(
    () => calendarItemsByDate(tasks.data ?? {}, eventsByDate ?? {}, viewerId, {
      done: t("calendar_preview_done"),
      hint: t("calendar_preview_hint"),
      withCoach: t("event_with_coach"),
      cancelled: t("event_cancelled"),
    }, palette),
    [tasks.data, eventsByDate, viewerId, t, palette],
  );

  return {
    days,
    tasksByDate: tasks.data ?? {},
    itemsByDate,
    holidaysByDate: holidays.isError ? {} : holidays.data ?? {},
    loading: tasks.data === undefined,
    dayLoading: tasks.data === undefined || !meetings.isFetched,
    isError: tasks.isError,
    isRefetching: tasks.isRefetching,
    refetch: () => void tasks.refetch(),
  };
}
