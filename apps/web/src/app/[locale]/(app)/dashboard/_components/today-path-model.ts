import type { PlanTaskDto, QuestProgressView } from "@mentor/types";
import {
  buildStudySessionHrefFromPlanTask,
  type StudySessionHref,
} from "@/lib/plan-study-session-link";

/** How many task nodes the path draws before it folds the rest into "+N". */
export const PATH_WINDOW = 5;
/** The weekly coin allowance (5 active days) is the chest at the end of the path. */
export const CHEST_QUEST_ID = "weekly.effort-allowance";

export type PathNodeState = "done" | "current" | "upcoming";

export interface PathNode {
  task: PlanTaskDto;
  state: PathNodeState;
  /** Assigned by the student's human coach (not the AI). */
  fromCoach: boolean;
  /** Length of the task's own time range, when it has a usable one. */
  rangeMinutes: number | null;
}

export interface PathChest {
  current: number;
  target: number;
  reward: number;
  open: boolean;
}

export type PathCta =
  | {
      kind: "START_TASK";
      task: PlanTaskDto;
      /** What the label promises and the session opens with — always the same number. */
      minutes: number;
      /** Passed to `/study-session` only when it differs from the default preset. */
      minutesParam: number | null;
    }
  | { kind: "ADD_TASK" }
  | { kind: "DAY_COMPLETE" };

export interface TodayPath {
  nodes: PathNode[];
  /** Tasks folded before the window. Always done: the window starts one before the first pending. */
  hiddenBefore: number;
  hiddenAfter: number;
  done: number;
  total: number;
  chest: PathChest | null;
  cta: PathCta;
}

function toMinutes(clock: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(clock);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** `startTime`–`endTime` in minutes; null unless both are set and the end is after the start. */
export function taskRangeMinutes(
  task: Pick<PlanTaskDto, "startTime" | "endTime">,
): number | null {
  if (!task.startTime || !task.endTime) return null;
  const start = toMinutes(task.startTime);
  const end = toMinutes(task.endTime);
  if (start == null || end == null || end <= start) return null;
  return end - start;
}

/**
 * The session screen accepts a custom length of 5–120 minutes in steps of 5
 * (`study-session/_components/session-params.ts`). Anything else would silently open the default
 * preset, so it is not offered at all: the label then shows the preset instead.
 */
export function sessionMinutesParam(minutes: number | null): number | null {
  if (minutes == null) return null;
  return minutes >= 5 && minutes <= 120 && minutes % 5 === 0 ? minutes : null;
}

/** Minutes a task's session opens with, and the param that asks for it (null = the preset). */
function taskSessionMinutes(
  task: PlanTaskDto,
  defaultMinutes: number,
): { minutes: number; param: number | null } {
  const own = sessionMinutesParam(taskRangeMinutes(task));
  return {
    minutes: own ?? defaultMinutes,
    param: own != null && own !== defaultMinutes ? own : null,
  };
}

/** `/study-session` for this task from the panel; carries the task's own length when it has one. */
export function sessionHrefFor(task: PlanTaskDto, defaultMinutes: number): StudySessionHref {
  const href = buildStudySessionHrefFromPlanTask(task, "dashboard");
  const { param } = taskSessionMinutes(task, defaultMinutes);
  if (typeof href === "string" || param == null) return href;
  return { ...href, query: { ...href.query, minutes: String(param) } };
}

/**
 * Tasks + quests → the path. "Current" is the first pending task in list order, which is exactly
 * the rule `today.service.ts#nextAction` applies on the server; deriving it here keeps the path
 * honest during an optimistic toggle, before the refreshed `nextAction` arrives.
 */
export function buildTodayPath(
  tasks: readonly PlanTaskDto[],
  quests: readonly QuestProgressView[] | null,
  defaultMinutes: number,
): TodayPath {
  const total = tasks.length;
  const currentIndex = tasks.findIndex((task) => task.status === "PENDING");
  const anchor = currentIndex === -1 ? total - 1 : currentIndex;
  const start = Math.max(0, Math.min(anchor - 1, total - PATH_WINDOW));
  const windowTasks = tasks.slice(start, start + PATH_WINDOW);

  const nodes = windowTasks.map((task, offset): PathNode => {
    const index = start + offset;
    return {
      task,
      state:
        task.status === "DONE"
          ? "done"
          : index === currentIndex
            ? "current"
            : "upcoming",
      fromCoach: task.origin?.type === "MENTORSHIP",
      rangeMinutes: taskRangeMinutes(task),
    };
  });

  const current = currentIndex === -1 ? null : tasks[currentIndex]!;
  const session = current ? taskSessionMinutes(current, defaultMinutes) : null;
  const cta: PathCta =
    current && session
      ? {
          kind: "START_TASK",
          task: current,
          minutes: session.minutes,
          minutesParam: session.param,
        }
      : total === 0
      ? { kind: "ADD_TASK" }
      : { kind: "DAY_COMPLETE" };

  const chestQuest = quests?.find((quest) => quest.id === CHEST_QUEST_ID);
  const chest: PathChest | null =
    chestQuest && chestQuest.progressTarget
      ? {
          current: Math.min(chestQuest.progressCurrent ?? 0, chestQuest.progressTarget),
          target: chestQuest.progressTarget,
          reward: chestQuest.rewardAmount,
          open: chestQuest.completed,
        }
      : null;

  return {
    nodes,
    hiddenBefore: start,
    hiddenAfter: total - start - windowTasks.length,
    done: tasks.filter((task) => task.status === "DONE").length,
    total,
    chest,
    cta,
  };
}
