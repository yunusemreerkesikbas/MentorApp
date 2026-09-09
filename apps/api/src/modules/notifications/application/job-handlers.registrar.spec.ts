import { describe, expect, it, vi } from "vitest";
import { JobName } from "../domain/notifications.constants";
import { JobHandlersRegistrar } from "./job-handlers.registrar";

describe("JobHandlersRegistrar", () => {
  it("registers the plan event reminder handler once", async () => {
    const registerHandler = vi.fn();
    const planEventReminder = { handle: vi.fn().mockResolvedValue(undefined) };
    const handlers = Array.from({ length: 4 }, () => ({
      handle: vi.fn().mockResolvedValue(undefined),
    }));
    const registrar = Reflect.construct(JobHandlersRegistrar, [
      { registerHandler },
      ...handlers,
      planEventReminder,
    ]) as JobHandlersRegistrar;

    registrar.onModuleInit();

    const registration = registerHandler.mock.calls.find(
      ([name]) => name === JobName.PLAN_EVENT_REMINDER,
    );
    expect(registration).toBeDefined();
    await registration?.[1]({ eventId: "event" });
    expect(planEventReminder.handle).toHaveBeenCalledWith({ eventId: "event" });
  });
});
