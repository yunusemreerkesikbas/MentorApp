import { CoachActionStatus, CoachActionType } from "@mentor/types";
import { CoachActionService } from "./coach-action.service";

const action = {
  type: CoachActionType.CREATE_PLAN_TASK,
  label: "Plana ekle",
  payload: { title: "Matematik tekrar", subject: "Matematik" },
} as const;

describe("CoachActionService", () => {
  it("claims a proposed action before calling coaching and stores the result", async () => {
    const messages = {
      getOwnedCoachAction: vi.fn(async () => ({
        action,
        status: CoachActionStatus.PROPOSED,
        resultRefId: null,
      })),
      transitionAction: vi.fn(async () => true),
      setActionResult: vi.fn(async () => true),
    };
    const plan = {
      createFromAiCoach: vi.fn(async () => ({ id: "task-1" })),
    };
    const service = new CoachActionService(messages as never, plan as never);

    await expect(
      service.decide("user-1", "message-1", "ACCEPT"),
    ).resolves.toEqual({
      action,
      status: CoachActionStatus.ACCEPTED,
      resultRefId: "task-1",
    });
    expect(messages.transitionAction).toHaveBeenCalledWith(
      "user-1",
      "message-1",
      CoachActionStatus.PROPOSED,
      CoachActionStatus.ACCEPTED,
    );
    expect(plan.createFromAiCoach).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ title: "Matematik tekrar" }),
      "message-1",
    );
  });

  it("cancels without mutating coaching data", async () => {
    const messages = {
      getOwnedCoachAction: vi.fn(async () => ({
        action,
        status: CoachActionStatus.PROPOSED,
        resultRefId: null,
      })),
      transitionAction: vi.fn(async () => true),
    };
    const plan = { createFromAiCoach: vi.fn() };
    const service = new CoachActionService(messages as never, plan as never);
    await expect(
      service.decide("user-1", "message-1", "CANCEL"),
    ).resolves.toMatchObject({ status: CoachActionStatus.CANCELLED });
    expect(plan.createFromAiCoach).not.toHaveBeenCalled();
  });

  it("returns the stored result on an idempotent accept retry", async () => {
    const messages = {
      getOwnedCoachAction: vi.fn(async () => ({
        action,
        status: CoachActionStatus.ACCEPTED,
        resultRefId: "task-existing",
      })),
      transitionAction: vi.fn(),
      setActionResult: vi.fn(),
    };
    const plan = { createFromAiCoach: vi.fn() };
    const service = new CoachActionService(messages as never, plan as never);

    await expect(
      service.decide("user-1", "message-1", "ACCEPT"),
    ).resolves.toMatchObject({
      status: CoachActionStatus.ACCEPTED,
      resultRefId: "task-existing",
    });
    expect(messages.transitionAction).not.toHaveBeenCalled();
    expect(plan.createFromAiCoach).not.toHaveBeenCalled();
  });

  it("starts a plan session only after explicit acceptance", async () => {
    const startAction = {
      type: CoachActionType.START_PLAN_SESSION,
      label: "Seansı başlat",
      payload: { planTaskId: "task-1" },
    } as const;
    const messages = {
      getOwnedCoachAction: vi.fn(async () => ({
        action: startAction,
        status: CoachActionStatus.PROPOSED,
        resultRefId: null,
      })),
      transitionAction: vi.fn(async () => true),
      setActionResult: vi.fn(async () => true),
    };
    const sessions = {
      startFromAiCoach: vi.fn(async () => ({ id: "session-1" })),
    };
    const service = new CoachActionService(
      messages as never,
      { createFromAiCoach: vi.fn() } as never,
      sessions as never,
    );

    await expect(
      service.decide("user-1", "message-1", "ACCEPT"),
    ).resolves.toMatchObject({ resultRefId: "session-1" });
    expect(sessions.startFromAiCoach).toHaveBeenCalledWith("user-1", "task-1");
  });
});
