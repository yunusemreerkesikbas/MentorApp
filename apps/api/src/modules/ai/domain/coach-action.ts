import {
  CoachActionStatus,
  type CoachActionStatus as CoachActionStatusValue,
} from "@mentor/types";

export type CoachActionTransition = "ACCEPT" | "CANCEL" | "COMPLETE";

export function nextCoachActionStatus(
  current: CoachActionStatusValue,
  transition: CoachActionTransition,
): CoachActionStatusValue | null {
  if (current === CoachActionStatus.PROPOSED) {
    if (transition === "ACCEPT") return CoachActionStatus.ACCEPTED;
    if (transition === "CANCEL") return CoachActionStatus.CANCELLED;
  }
  if (current === CoachActionStatus.ACCEPTED && transition === "COMPLETE") {
    return CoachActionStatus.COMPLETED;
  }
  return null;
}
