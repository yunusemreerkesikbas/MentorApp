/** Coaching domain events — emitted via EventEmitter2. */

export { STREAK_MILESTONES, type StreakMilestoneValue } from "@mentor/core";

export const CoachingEventTopic = {
  STREAK_BROKEN:     "coaching.streak-broken",
  STREAK_MILESTONE:  "coaching.streak-milestone",
  MOOD_LOW:          "coaching.mood-low",
  FIRST_SESSION:     "coaching.first-session",
  SESSION_COMPLETED: "coaching.session-completed",
  PLAN_COMPLETED:    "coaching.plan-completed",
  PLAN_TASK_COMPLETED: "coaching.plan-task-completed",
} as const;

export class StreakBroken {
  constructor(
    readonly userId: string,
    readonly previousStreak: number,
  ) {}
}

export class StreakMilestone {
  constructor(readonly userId: string, readonly milestone: number) {}
}

export class MoodLow {
  constructor(readonly userId: string, readonly mood: number) {}
}

export class FirstSessionOfDay {
  constructor(readonly userId: string) {}
}

/** Emitted whenever a study session is finalized as COMPLETED (every session, not just first-of-day). */
export class StudySessionCompleted {
  constructor(readonly userId: string) {}
}

export class DailyPlanCompleted {
  constructor(readonly userId: string, readonly tasksCount: number) {}
}

export class PlanTaskCompleted {
  constructor(
    readonly userId: string,
    readonly taskId: string,
  ) {}
}
