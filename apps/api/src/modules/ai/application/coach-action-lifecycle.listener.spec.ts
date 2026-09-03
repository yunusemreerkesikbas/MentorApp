import { describe, expect, it, vi } from "vitest";

import { PlanTaskCompleted } from "../../coaching/domain/coaching.events";
import { CoachActionLifecycleListener } from "./coach-action-lifecycle.listener";

describe("CoachActionLifecycleListener", () => {
  it("marks the matching accepted coach action completed", async () => {
    const completeActionForResult = vi.fn(async () => true);
    const listener = new CoachActionLifecycleListener({
      completeActionForResult,
    } as never);

    // taskDate/originType/originRefId (added for W8) are irrelevant to this listener — it only
    // ever reads userId/taskId — but the constructor is required-arity by design (coaching.events.ts).
    await listener.onPlanTaskCompleted(
      new PlanTaskCompleted("user-1", "task-1", "2026-09-03", null, null),
    );

    expect(completeActionForResult).toHaveBeenCalledWith("user-1", "task-1");
  });
});
