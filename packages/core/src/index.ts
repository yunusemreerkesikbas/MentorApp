/**
 * @mentor/core — framework-agnostic domain constants/helpers.
 *
 * PRINCIPLE (§0): the product is exam-agnostic. Exams differ only by *config*.
 * The net rule is one example: KPSS/YKS → C − W/4, LGS → C − W/3.
 * This is only the config contract; analysis feature code comes later in the api.
 */
import { ExamType } from "@mentor/types";

/** Per-exam wrong-answer penalty divisor (net = correct − wrong / penaltyDivisor). */
export const NET_PENALTY_DIVISOR: Record<ExamType, number> = {
  [ExamType.KPSS]: 4,
  [ExamType.YKS]: 4,
  [ExamType.LGS]: 3,
};

export const APP_NAME = "Mentor" as const;

export const STREAK_MILESTONES = [7, 14, 30, 100, 365] as const;
export type StreakMilestoneValue = (typeof STREAK_MILESTONES)[number];
