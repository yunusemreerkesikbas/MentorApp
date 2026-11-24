/**
 * Moved to `@mentor/core` (shared with the mobile Takvim); re-exported so web imports stay put.
 * Convention shared with the API: `startTime === null` means ALL-DAY, times are wall-clock "HH:MM".
 */
export {
  DAY_MINUTES,
  DEFAULT_EVENT_MINUTES,
  earliestStartMinute,
  hhmmFromMinutes,
  layoutDayEvents,
  minutesFromHhmm,
  monthGridDays,
} from "@mentor/core";
export type { DayLayout, TimedEventLayout, TimedInput } from "@mentor/core";
