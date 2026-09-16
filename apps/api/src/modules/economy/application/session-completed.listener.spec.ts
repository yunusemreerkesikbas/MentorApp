import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudySessionCompleted } from "../../coaching/domain/coaching.events";
import { SessionCompletedListener } from "./session-completed.listener";

const quests = { evaluate: vi.fn().mockResolvedValue(undefined) };

const listener = () => new SessionCompletedListener(quests as never);

describe("SessionCompletedListener", () => {
  beforeEach(() => {
    quests.evaluate.mockClear();
  });

  it("re-evaluates quests when a study session is completed", async () => {
    await listener().onSessionCompleted(new StudySessionCompleted("user-1", new Date("2026-09-13T23:59:00Z")));
    expect(quests.evaluate).toHaveBeenCalledWith({ userId: "user-1", date: "2026-09-13" });
  });
});
