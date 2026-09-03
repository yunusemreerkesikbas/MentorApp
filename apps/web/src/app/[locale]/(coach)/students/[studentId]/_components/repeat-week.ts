import type { MentorshipReportPlanTaskDto } from "@mentor/types";
import type { MentorshipAssignmentDraft } from "@/lib/mentorship";

/**
 * "Copy last week" — the composer's answer to the actual bottleneck: a coach at the 20-student
 * quota rewriting the same week by hand every Monday (roadmap §9, "same team, 2-3x students").
 *
 * The source is the report the page already loaded, so this costs no request. Only rows THIS
 * coach authored are copied: the rest of the report is the student's own plan, and lifting it
 * would turn their choices into the coach's assignments.
 */

const DAY_MS = 86_400_000;

/** Whole days from `a` to `b`, both `yyyy-mm-dd`. UTC parsing, so no DST cliff. */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

function shiftDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * @param planTasks the report's plan rows (past 14 days plus anything already scheduled ahead)
 * @param days the seven dates the composer is showing, `days[0]` being the week's first day
 * @param today `yyyy-mm-dd` in the coach's own calendar
 * @param capacity how many drafts still fit under the 21-task ceiling
 *
 * The source window is the seven days before TODAY, never before `days[0]`: the composer can be
 * parked on a future week, and "the week before the week I am looking at" would walk out of the
 * report's 14-day window and silently return nothing. Both weeks start on the same weekday
 * (the week button steps by exactly 7), so position in the week is preserved either way.
 */
export function buildRepeatDrafts(
  planTasks: readonly MentorshipReportPlanTaskDto[],
  days: readonly string[],
  today: string,
  capacity: number,
): (MentorshipAssignmentDraft & { taskDate: string })[] {
  if (capacity <= 0 || days.length === 0) return [];
  const sourceStart = shiftDays(today, -days.length);

  const drafts: (MentorshipAssignmentDraft & { taskDate: string })[] = [];
  for (const task of planTasks) {
    if (!task.assignedByCoach) continue;
    const offset = daysBetween(sourceStart, task.taskDate);
    const target = days[offset];
    if (target === undefined) continue;
    drafts.push({
      title: task.title,
      subject: task.subject,
      topic: task.topic,
      coachNote: task.coachNote,
      taskDate: target,
    });
    if (drafts.length === capacity) break;
  }
  return drafts;
}
