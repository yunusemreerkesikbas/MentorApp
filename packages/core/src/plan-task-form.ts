import {
  SESSION_FOCUS_MINUTES_MAX,
  SESSION_FOCUS_MINUTES_MIN,
  type PlanTaskDto,
} from "@mentor/types";
import { canonicalHm } from "./plan-items.js";

/**
 * The add/edit task form as the student typed it. Web and mobile both shape it here, so the
 * validation order and the payload rules (times as a pair, a weekly-report subject kept) stay one.
 */
export interface PlanTaskDraft {
  title: string;
  subject: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  description: string;
  /** Raw field text; "" means no duration. */
  duration: string;
}

export interface PlanTaskFormValues {
  title: string;
  subject: string;
  /** null = all-day (the API's own convention). */
  startTime: string | null;
  endTime: string | null;
  description: string | null;
  durationMinutes: number | null;
}

export type PlanTaskDraftError = "duration_invalid" | "task_required" | "time_invalid";

/** Default block length when the student turns off "all day" without picking an end. */
export function plusOneHour(start: string): string {
  const [h, m] = start.split(":").map(Number);
  return `${String(Math.min(23, (h ?? 0) + 1)).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
}

/** The end after the student moves the start: one at or before the new start moves an hour past it. */
export function endTimeAfterStart(start: string, end: string): string {
  const from = canonicalHm(start);
  const to = canonicalHm(end);
  return from && to && to <= from ? plusOneHour(from) : end;
}

/** The first problem in the web's order (duration, title, times), or null. */
export function planTaskDraftError(draft: PlanTaskDraft): PlanTaskDraftError | null {
  if (draft.duration !== "") {
    const minutes = Number(draft.duration);
    if (
      !Number.isInteger(minutes) ||
      minutes < SESSION_FOCUS_MINUTES_MIN ||
      minutes > SESSION_FOCUS_MINUTES_MAX
    ) {
      return "duration_invalid";
    }
  }
  if (!draft.title.trim()) return "task_required";
  if (!draft.allDay) {
    const start = canonicalHm(draft.startTime);
    const end = draft.endTime.trim() ? canonicalHm(draft.endTime) : null;
    if (!start || (draft.endTime.trim() && !end) || (end && end <= start)) return "time_invalid";
  }
  return null;
}

export function planTaskFormValues(draft: PlanTaskDraft): PlanTaskFormValues {
  return {
    title: draft.title,
    subject: draft.subject,
    startTime: draft.allDay ? null : (canonicalHm(draft.startTime) ?? draft.startTime),
    endTime:
      draft.allDay || !draft.endTime.trim()
        ? null
        : (canonicalHm(draft.endTime) ?? draft.endTime),
    description: draft.description.trim() ? draft.description.trim() : null,
    durationMinutes: draft.duration === "" ? null : Number(draft.duration),
  };
}

/** A new task on `taskDate`: only what was filled in. */
export function planTaskCreateInput(
  values: PlanTaskFormValues,
  taskDate: string,
): {
  title: string;
  taskDate: string;
  subject?: string;
  startTime?: string | null;
  endTime?: string | null;
  description?: string;
  durationMinutes: number | null;
} {
  const subject = values.subject.trim();
  return {
    title: values.title.trim(),
    taskDate,
    ...(subject ? { subject } : {}),
    ...(values.startTime ? { startTime: values.startTime, endTime: values.endTime } : {}),
    ...(values.description ? { description: values.description } : {}),
    durationMinutes: values.durationMinutes,
  };
}

/** An edit: times always as a pair (the update schema's contract); a weekly-report task keeps its subject. */
export function planTaskUpdateInput(
  values: PlanTaskFormValues,
  task: Pick<PlanTaskDto, "origin" | "subject">,
): {
  title: string;
  subject: string | null;
  startTime: string | null;
  endTime: string | null;
  description: string | null;
  durationMinutes: number | null;
} {
  const subject = values.subject.trim();
  return {
    title: values.title.trim(),
    subject: task.origin?.type === "WEEKLY_REPORT" ? task.subject : subject ? subject : null,
    startTime: values.startTime,
    endTime: values.endTime,
    description: values.description,
    durationMinutes: values.durationMinutes,
  };
}
