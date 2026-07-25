import type { TodayPanelResponse } from "@mentor/types";
import { buildStudySessionHrefFromPlanTask } from "@/lib/plan-study-session-link";

export type CoachNextActionHref =
  | ReturnType<typeof buildStudySessionHrefFromPlanTask>
  | {
      pathname: "/plan";
      query: { add: string; source: string };
    };

/** Shared CTA target for dashboard card + coach landing chip. */
export function resolveCoachNextActionHref(
  today: TodayPanelResponse,
  surface: "dashboard" | "coach",
): CoachNextActionHref | null {
  const { nextAction } = today;
  const task = nextAction.taskId
    ? today.tasks.find((item) => item.id === nextAction.taskId)
    : null;

  if (nextAction.kind === "START_TASK" && task) {
    return buildStudySessionHrefFromPlanTask(task, surface);
  }
  if (nextAction.kind === "ADD_TASK") {
    return {
      pathname: "/plan",
      query: { add: "1", source: surface },
    };
  }
  return null;
}
