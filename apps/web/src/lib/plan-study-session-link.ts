import type { PlanTaskDto } from "@mentor/types";

/** Matches @mentor/validation plan task title max length. */
export const PLAN_TASK_TITLE_MAX = 80;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PlanTaskStudySessionLinkInput = Pick<
  PlanTaskDto,
  "id" | "title" | "subject"
>;

export type StudySessionHref =
  | "/study-session"
  | {
      pathname: "/study-session";
      query: Record<string, string>;
    };

/** Deep-link from a plan task into `/study-session` with subject + task context (FE-only; no backend taskId). */
export function buildStudySessionHrefFromPlanTask(
  task: PlanTaskStudySessionLinkInput,
  source?: "coach",
): StudySessionHref {
  const query: Record<string, string> = {
    taskId: task.id,
  };

  if (source) query.source = source;
  const title = task.title.trim().slice(0, PLAN_TASK_TITLE_MAX);
  if (title) {
    query.taskTitle = title;
  }

  const subject = task.subject?.trim();
  if (subject) {
    query.subject = subject;
  }

  return { pathname: "/study-session", query };
}

export interface PlanTaskStudySessionContext {
  taskTitle: string | null;
  taskId: string | null;
}

/** Parse plan-task query params on the study-session screen (URL-decoded by Next.js). */
export function parsePlanTaskContextFromParams(params: {
  taskTitle: string | null;
  taskId: string | null;
}): PlanTaskStudySessionContext {
  const rawTitle = params.taskTitle?.trim() ?? "";
  const taskTitle = rawTitle ? rawTitle.slice(0, PLAN_TASK_TITLE_MAX) : null;

  const rawId = params.taskId?.trim() ?? "";
  const taskId = rawId && UUID_RE.test(rawId) ? rawId : null;

  if (!taskTitle && !taskId) {
    return { taskTitle: null, taskId: null };
  }

  return { taskTitle, taskId };
}
