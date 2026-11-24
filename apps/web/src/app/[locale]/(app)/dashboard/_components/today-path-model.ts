import type { PlanTaskDto } from "@mentor/types";
import {
  buildStudySessionHrefFromPlanTask,
  type StudySessionHref,
} from "@/lib/plan-study-session-link";

// The path model is pure and shared with the mobile app, so it lives in `@mentor/core`.
export {
  buildTodayPath,
  CHEST_QUEST_ID,
  PATH_WINDOW,
  type PathCta,
  type PathNode,
  type PathNodeState,
  type TodayPath,
} from "@mentor/core";

/** Every surface uses the shared link builder; no dashboard-specific duration calculation. */
export function sessionHrefFor(task: PlanTaskDto): StudySessionHref {
  return buildStudySessionHrefFromPlanTask(task, "dashboard");
}
