import type { MentorshipPlanningTaskDto } from "@mentor/types";
import type { MentorshipAssignmentDraft } from "@/lib/mentorship";
import { todayInIstanbul } from "@/lib/date-time";

export const MAX_DRAFTS = 21;
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
export interface PlanningState {
  week: string;
  day: string;
  editor: AssignDraft | null;
  copied: string[];
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
