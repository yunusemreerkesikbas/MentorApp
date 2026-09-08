import type { PlanTaskStatus } from "@mentor/types";

export interface ComparableSubjectAttempt {
  mockExamId: string;
  subjectRef: string;
  takenAt: Date;
  createdAt: Date;
  net: string;
}

export function toSharePercent(count: number, total: number): number {
  if (count <= 0 || total <= 0) return 0;
  return Math.round((count / total) * 100);
}

export function selectFirstComparableFollowUp(
  attempts: ComparableSubjectAttempt[],
  scope: {
    subjectRef: string;
    baselineTakenAt: Date;
    planCreatedAt: Date;
  },
): ComparableSubjectAttempt | null {
  const baselineDate = scope.baselineTakenAt.toISOString().slice(0, 10);
  let selected: ComparableSubjectAttempt | null = null;
  for (const attempt of attempts) {
    if (
      attempt.subjectRef !== scope.subjectRef ||
      attempt.createdAt <= scope.planCreatedAt ||
      attempt.takenAt.toISOString().slice(0, 10) <= baselineDate
    ) {
      continue;
    }
    if (
      !selected ||
      attempt.takenAt < selected.takenAt ||
      (attempt.takenAt.getTime() === selected.takenAt.getTime() &&
        attempt.createdAt < selected.createdAt)
    ) {
      selected = attempt;
    }
  }
  return selected;
}

export function analysisCycleSteps(input: {
  taskStatus: PlanTaskStatus;
  reviewedAfterPlanCount: number;
  hasFollowUp: boolean;
}) {
  const practiced =
    input.taskStatus === "DONE" || input.reviewedAfterPlanCount > 0;
  return {
    planned: true as const,
    practiced,
    measured: input.hasFollowUp,
    closed: practiced && input.hasFollowUp,
  };
}
