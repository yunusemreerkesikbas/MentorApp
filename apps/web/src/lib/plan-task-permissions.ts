import type { PlanTaskDto } from "@mentor/types";

/**
 * A task assigned by the student's human coach (W8).
 *
 * The API lets the student complete or delete it but refuses any content edit
 * (`COACHING_TASK_COACH_ASSIGNED`), because a rewritten title would make the coach's report
 * quietly untrue. Every surface that offers an edit control must ask this first — an edit button
 * that always 403s is worse than no button.
 *
 * It lives here rather than inline because the plan screen offers editing from two places (the row
 * menu and the calendar event sheet), and two copies of one rule drift.
 */
export function isCoachAssigned(task: Pick<PlanTaskDto, "origin">): boolean {
  return task.origin?.type === "MENTORSHIP";
}
