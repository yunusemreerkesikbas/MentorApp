import type { MentorshipPlanningTaskDto } from "@mentor/types";
import type { MentorshipAssignmentDraft } from "@/lib/mentorship";
import { todayInIstanbul } from "@/lib/date-time";

export {
  MENTORSHIP_ASSIGNMENT_MAX_TASKS as MAX_DRAFTS,
  MENTORSHIP_ASSIGNMENT_MAX_DAYS_AHEAD as MAX_DAYS_AHEAD,
} from "@mentor/validation";
export function shiftDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function monday(date: string) {
  return shiftDate(
    date,
    -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7),
  );
}
export interface AssignDraft extends MentorshipAssignmentDraft {
  key: string;
  taskDate: string;
}

export function assignmentInput({
  title,
  taskDate,
  subject,
  topic,
  coachNote,
}: AssignDraft): MentorshipAssignmentDraft {
  return { title, taskDate, subject, topic, coachNote };
}
export interface PlanningState {
  week: string;
  day: string;
  /**
   * What the always-open composer holds: `null` is a blank new task; a draft whose key is in the
   * program is an edit in progress; any other draft is a new task being typed.
   */
  editor: AssignDraft | null;
  copied: string[];
}

export type DayCount =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "existing"; existing: number }
  | { kind: "drafts"; drafts: number }
  | { kind: "both"; existing: number; drafts: number };

/**
 * A day chip's third line: "2 görev", "2 + 1 taslak", "1 taslak" or nothing. `existing` is
 * undefined while the week's tasks load; a draft the composer already knows is shown meanwhile.
 */
export function dayCount(existing: number | undefined, drafts: number): DayCount {
  if (existing === undefined) return drafts > 0 ? { kind: "drafts", drafts } : { kind: "loading" };
  if (existing > 0 && drafts > 0) return { kind: "both", existing, drafts };
  if (existing > 0) return { kind: "existing", existing };
  return drafts > 0 ? { kind: "drafts", drafts } : { kind: "none" };
}

export function composerMode(
  editor: AssignDraft | null,
  drafts: readonly AssignDraft[],
): "new" | "edit" {
  return editor !== null && drafts.some((d) => d.key === editor.key) ? "edit" : "new";
}

/** A day chip was chosen: a new task goes with it, an edited draft keeps the date it had. */
export function followDay(
  editor: AssignDraft | null,
  day: string,
  drafts: readonly AssignDraft[],
): AssignDraft | null {
  if (editor === null || composerMode(editor, drafts) === "edit") return editor;
  return { ...editor, taskDate: day };
}

/**
 * The week arrows and "Bu haftaya dön": this week opens on today, any other on its Monday, and a
 * new task being typed moves to that day like it does on a chip; an edited draft keeps its date.
 */
export function showWeek(
  state: PlanningState,
  week: string,
  today: string,
  drafts: readonly AssignDraft[],
): PlanningState {
  const day = week === monday(today) ? today : week;
  return { ...state, week, day, editor: followDay(state.editor, day, drafts) };
}

/** Whether sending now would leave something behind in the composer. */
export function hasUnsavedInput(
  editor: AssignDraft | null,
  drafts: readonly AssignDraft[],
): boolean {
  if (editor === null) return false;
  if (composerMode(editor, drafts) === "edit") return true;
  return [editor.title, editor.subject, editor.topic, editor.coachNote].some(
    (value) => (value ?? "").trim() !== "",
  );
}
export function initialPlanningState(): PlanningState {
  const day = todayInIstanbul();
  return { day, week: monday(day), editor: null, copied: [] };
}
export function copyKey(id: string, week: string) {
  return `${id}:${week}`;
}
export function copyTask(
  task: MentorshipPlanningTaskDto,
  source: string,
  target: string,
): AssignDraft {
  const offset = Math.round(
    (Date.parse(task.taskDate) - Date.parse(source)) / 86400000,
  );
  return {
    key: crypto.randomUUID(),
    taskDate: shiftDate(target, offset),
    title: task.title,
    subject: task.subject,
    topic: task.topic,
    coachNote: task.coachNote,
  };
}
