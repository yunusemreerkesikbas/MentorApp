import { describe, expect, it, vi } from "vitest";

import { PlanTaskCompleted } from "../../coaching/domain/coaching.events";
import { CoachActionLifecycleListener } from "./coach-action-lifecycle.listener";

describe("CoachActionLifecycleListener", () => {
  it("marks the matching accepted coach action completed", async () => {
    const completeActionForResult = vi.fn(async () => true);
    const listener = new CoachActionLifecycleListener({
      completeActionForResult,
    } as never);

    await listener.onPlanTaskCompleted(
      new PlanTaskCompleted("user-1", "task-1"),
    );

    expect(completeActionForResult).toHaveBeenCalledWith("user-1", "task-1");
  });
});
