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
  /** Backend-resolved session length, shared by the node, CTA and link. */
  minutes: number | null;
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
      minutes: number | null;
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

/** Every surface uses the shared link builder; no dashboard-specific duration calculation. */
export function sessionHrefFor(task: PlanTaskDto): StudySessionHref {
  return buildStudySessionHrefFromPlanTask(task, "dashboard");
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
      minutes: task.sessionFocusMinutes === undefined ? defaultMinutes : task.sessionFocusMinutes,
    };
  });

  const current = currentIndex === -1 ? null : tasks[currentIndex]!;
  const minutes = current?.sessionFocusMinutes === undefined ? defaultMinutes : current.sessionFocusMinutes;
  const cta: PathCta =
    current
      ? {
          kind: "START_TASK",
          task: current,
          minutes,
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
