import type { CoachPlanAdaptationChangeDto } from "@mentor/types";
import {
  coachPlanAdaptationSchema,
  type ApplyPlanAdaptationInput,
  type CoachPlanAdaptationInput,
} from "@mentor/validation";

export interface PlanAdaptationRow {
  key: string;
  date: string;
  change: CoachPlanAdaptationChangeDto;
}

export function flattenPlanAdaptationChanges(
  changes: readonly CoachPlanAdaptationChangeDto[],
): PlanAdaptationRow[] {
  return changes.map((change, index) => ({
    key:
      change.kind === "MOVE"
        ? `MOVE:${change.taskId}`
        : `ADD:${change.taskDate}:${index}`,
    date: change.kind === "MOVE" ? change.toDate : change.taskDate,
    change,
  }));
}

export function selectedPlanAdaptationChanges(
  rows: readonly PlanAdaptationRow[],
  selected: ReadonlySet<string>,
): ApplyPlanAdaptationInput["changes"] {
  return rows.filter((row) => selected.has(row.key)).map((row) => row.change);
}

export function parsePlanAdaptationQuery(input: {
  coach: string | null;
  source: string | null;
  sessionId: string | null;
}): CoachPlanAdaptationInput | null {
  if (input.coach !== "adapt") return null;
  const candidate =
    input.source === "mood"
      ? { source: "MOOD" as const }
      : input.source === "session"
        ? { source: "SESSION" as const, sessionId: input.sessionId ?? "" }
        : input.source === "plan"
          ? { source: "PLAN" as const }
          : null;
  if (!candidate) return null;
  const parsed = coachPlanAdaptationSchema.safeParse(candidate);
  return parsed.success ? (candidate as CoachPlanAdaptationInput) : null;
}
