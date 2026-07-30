import { DEFAULT_EVENT_MINUTES, minutesFromHhmm } from "./plan-calendar-layout";

/** Minimum shape the summary needs — keeps it testable without building full DTOs. */
export interface SummarizableTask {
  title: string;
  subject: string | null;
  status: string;
  startTime: string | null;
  endTime: string | null;
}

export interface PlanSubjectSummary {
  done: number;
  total: number;
  percent: number;
  /** Distinct days the subject appears on — answers "did I cram it into one day?". */
  dayCount: number;
  /** Sum of timed durations; null when nothing in the month has a time. */
  plannedMinutes: number | null;
  /** Nearest task on or after today, within the loaded month; null when none is left. */
  next: { date: string; title: string } | null;
}

/**
 * Month-at-a-glance numbers for one subject, from the range the calendar already has loaded.
 * No request: the legend hover must be instant, and the deeper "am I neglecting this subject"
 * question belongs to Analiz, which has real evidence (nets, photo signals) instead of counts.
 */
export function summarizeSubjectMonth(
  subject: string,
  tasksByDate: Record<string, SummarizableTask[]>,
  monthKey: string,
  today: string,
): PlanSubjectSummary {
  let done = 0;
  let total = 0;
  let dayCount = 0;
  let plannedMinutes = 0;
  let hasTimed = false;
  let next: { date: string; title: string } | null = null;

  for (const iso of Object.keys(tasksByDate).sort()) {
    if (iso.slice(0, 7) !== monthKey) continue;
    const matches = (tasksByDate[iso] ?? []).filter(
      (task) => task.subject?.trim() === subject,
    );
    if (matches.length === 0) continue;

    dayCount += 1;
    for (const task of matches) {
      total += 1;
      if (task.status === "DONE") done += 1;
      if (task.startTime) {
        hasTimed = true;
        // Open-ended items are drawn as one hour on the board — count them the same way so the
        // number matches what the user actually sees.
        plannedMinutes += task.endTime
          ? minutesFromHhmm(task.endTime) - minutesFromHhmm(task.startTime)
          : DEFAULT_EVENT_MINUTES;
      }
    }

    // Keys are walked in date order, so the first hit from today onward is the next one up.
    if (next === null && iso >= today) {
      const upcoming =
        matches.find((task) => task.status !== "DONE") ?? matches[0]!;
      next = { date: iso, title: upcoming.title };
    }
  }

  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    dayCount,
    plannedMinutes: hasTimed ? plannedMinutes : null,
    next,
  };
}

/** "3 sa 30 dk" / "45 dk" — omits the hour part below 60 minutes. */
export function formatPlannedMinutes(
  minutes: number,
  labels: { hour: string; minute: string },
): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} ${labels.minute}`;
  if (rest === 0) return `${hours} ${labels.hour}`;
  return `${hours} ${labels.hour} ${rest} ${labels.minute}`;
}
