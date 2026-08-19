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
  PLAN_TASK_CREATED: "coaching.plan-task-created",
  PLAN_ADAPTED: "coaching.plan-adapted",
  VISION_BOARD_SAVED: "coaching.vision-board-saved",
  MOCK_EXAM_CREATED: "coaching.mock-exam-created",
  NOTEBOOK_ENTRY_REVIEWED: "coaching.notebook-entry-reviewed",
  WEEKLY_REVIEW_COMPLETED: "coaching.weekly-review-completed",
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
  constructor(readonly userId: string, readonly startedAt: Date) {}
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

export class PlanTaskCreated {
  constructor(readonly userId: string, readonly createdAt = new Date()) {}
}

export class PlanAdapted {
  constructor(readonly userId: string, readonly adaptedAt = new Date()) {}
}

export class VisionBoardSaved {
  constructor(readonly userId: string, readonly savedAt = new Date()) {}
}

export class MockExamCreated {
  constructor(readonly userId: string, readonly createdAt = new Date()) {}
}

export class NotebookEntryReviewed {
  constructor(readonly userId: string, readonly reviewedAt = new Date()) {}
}

export class WeeklyReviewCompleted {
  constructor(readonly userId: string, readonly completedAt = new Date()) {}
}
