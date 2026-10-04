import { describe, expect, it, vi } from "vitest";
import { QuestTriggerService } from "./quest-trigger.service";
import { PlanTaskCompleted } from "../../coaching/domain/coaching.events";

const userId = "10000000-0000-4000-8000-000000000001";

describe("QuestTriggerService", () => {
  function setup() {
    const quests = { evaluateAndGrant: vi.fn().mockResolvedValue(undefined) };
    const queue = { enqueue: vi.fn().mockResolvedValue({ jobId: "job" }) };
    const runner = { registerHandler: vi.fn() };
    const service = new QuestTriggerService(quests as never, queue as never, runner as never);
    service.onModuleInit();
    return { service, quests, queue, runner };
  }

  it("evaluates immediately using the task's date, without opening the quests page", async () => {
    const { service, quests, queue } = setup();
    await service.onPlanTask(new PlanTaskCompleted(userId, "task", "2026-09-13", null, null));
    expect(quests.evaluateAndGrant).toHaveBeenCalledWith(userId, "2026-09-13", true);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("retries the original Sunday even if the worker runs in the next ISO week", async () => {
    const { service, quests, queue, runner } = setup();
    quests.evaluateAndGrant.mockRejectedValueOnce(new Error("temporary database failure"));
    const payload = { userId, date: "2026-09-13" };
    await service.evaluate(payload);
    expect(queue.enqueue).toHaveBeenCalledWith("economy.evaluate-quests", payload);
    const handler = runner.registerHandler.mock.calls[0]![1];
    await handler(payload);
    expect(quests.evaluateAndGrant).toHaveBeenLastCalledWith(userId, "2026-09-13", true);
  });

  it("propagates worker failures so the existing queue can retry", async () => {
    const { quests, runner } = setup();
    quests.evaluateAndGrant.mockRejectedValue(new Error("offline"));
    await expect(runner.registerHandler.mock.calls[0]![1]({ userId, date: "2026-09-13" }))
      .rejects.toThrow("offline");
  });
});
