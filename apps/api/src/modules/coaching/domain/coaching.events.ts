/** Coaching domain events — emitted via EventEmitter2. */

export { STREAK_MILESTONES, type StreakMilestoneValue } from "@mentor/core";

export const CoachingEventTopic = {
  STREAK_BROKEN:     "coaching.streak-broken",
  STREAK_MILESTONE:  "coaching.streak-milestone",
  MOOD_LOW:          "coaching.mood-low",
  FIRST_SESSION:     "coaching.first-session",
  SESSION_COMPLETED: "coaching.session-completed",
  SESSION_STARTED:   "coaching.session-started",
  PLAN_COMPLETED:    "coaching.plan-completed",
  PLAN_TASK_COMPLETED: "coaching.plan-task-completed",
  PLAN_TASK_CREATED: "coaching.plan-task-created",
  PLAN_TASK_DELETED: "coaching.plan-task-deleted",
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

/**
 * Emitted when a session STARTS seated at a study room (solo starts emit nothing — nobody is
 * waiting on them). Carries the room so listeners need no extra lookup to scope the fan-out.
 */
export class StudyRoomSessionStarted {
  constructor(
    readonly userId: string,
    readonly roomId: string,
  ) {}
}

/** Emitted whenever a study session is finalized as COMPLETED (every session, not just first-of-day). */
export class StudySessionCompleted {
  constructor(readonly userId: string, readonly startedAt: Date) {}
}

export class DailyPlanCompleted {
  constructor(readonly userId: string, readonly tasksCount: number) {}
}

/**
 * A plan task was ticked off — by the user, or automatically by a session that was seated at it.
 *
 * The provenance fields travel with the event so a consumer can tell whose task this was without
 * reading `plan_tasks` (W2 owns that table). They are REQUIRED, not defaulted: a default would let
 * a new emit site quietly report "no origin" for a coach's assignment, and a silent wrong answer
 * is exactly what the no-silent-fallback rule exists to prevent.
 */
export class PlanTaskCompleted {
  constructor(
    readonly userId: string,
    readonly taskId: string,
    readonly taskDate: string,
    readonly originType: string | null,
    readonly originRefId: string | null,
  ) {}
}

/**
 * A plan task was removed by its owner. Emitted unconditionally — whether anyone cares that this
 * particular task is gone is the consumer's question, not the emitter's.
 *
 * Carries the title because it is the one thing that no longer exists to look up afterwards.
 */
export class PlanTaskDeleted {
  constructor(
    readonly userId: string,
    readonly taskId: string,
    readonly taskDate: string,
    readonly title: string,
    readonly originType: string | null,
    readonly originRefId: string | null,
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
