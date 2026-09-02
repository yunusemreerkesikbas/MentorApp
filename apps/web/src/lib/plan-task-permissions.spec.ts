import { describe, expect, it } from "vitest";
import { isCoachAssigned } from "./plan-task-permissions";

describe("isCoachAssigned", () => {
  it("is true only for a human coach's assignment", () => {
    expect(isCoachAssigned({ origin: { type: "MENTORSHIP", linkId: "l1" } })).toBe(true);
  });

  it("is false for the AI coach — that task is the student's own accepted suggestion", () => {
    expect(
      isCoachAssigned({ origin: { type: "AI_COACH", coachMessageId: "m1" } }),
    ).toBe(false);
  });

  it("is false for a community-origin task", () => {
    expect(
      isCoachAssigned({
        origin: {
          type: "COMMUNITY_COACH",
          conversationId: "c1",
          threadId: "t1",
          intent: "PLAN",
          zoneType: "QA",
        },
      }),
    ).toBe(false);
  });

  it("is false for a task the student wrote themselves", () => {
    expect(isCoachAssigned({ origin: null })).toBe(false);
  });
});
