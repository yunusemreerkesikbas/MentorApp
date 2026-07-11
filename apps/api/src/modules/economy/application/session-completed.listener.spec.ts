import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudySessionCompleted } from "../../coaching/domain/coaching.events";
import { SessionCompletedListener } from "./session-completed.listener";

const quests = { evaluateAndGrant: vi.fn().mockResolvedValue(undefined) };

const listener = () => new SessionCompletedListener(quests as never);

describe("SessionCompletedListener", () => {
  beforeEach(() => {
    quests.evaluateAndGrant.mockClear();
  });

  it("re-evaluates quests when a study session is completed", async () => {
    await listener().onSessionCompleted(new StudySessionCompleted("user-1"));
    expect(quests.evaluateAndGrant).toHaveBeenCalledWith("user-1");
  });
});
