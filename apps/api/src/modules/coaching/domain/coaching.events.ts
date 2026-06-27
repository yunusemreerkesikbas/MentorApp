/** Coaching domain events — emitted via EventEmitter2. */

export const CoachingEventTopic = {
  STREAK_BROKEN:    "coaching.streak-broken",
  STREAK_MILESTONE: "coaching.streak-milestone",
  MOOD_LOW:         "coaching.mood-low",
  FIRST_SESSION:    "coaching.first-session",
  PLAN_COMPLETED:   "coaching.plan-completed",
} as const;

export class StreakBroken {
  constructor(
    readonly userId: string,
    readonly previousStreak: number,
  ) {}
}

export const STREAK_MILESTONES = [7, 14, 30, 100, 365] as const;
export type StreakMilestoneValue = (typeof STREAK_MILESTONES)[number];

export class StreakMilestone {
  constructor(readonly userId: string, readonly milestone: number) {}
}

export class MoodLow {
  constructor(readonly userId: string, readonly mood: number) {}
}

export class FirstSessionOfDay {
  constructor(readonly userId: string) {}
}

export class DailyPlanCompleted {
  constructor(readonly userId: string, readonly tasksCount: number) {}
}
