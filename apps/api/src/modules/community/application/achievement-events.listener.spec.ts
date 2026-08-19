import { describe, expect, it, vi } from "vitest";
import { AchievementEventsListener } from "./achievement-events.listener";

function setup(returned = false) {
  const achievements = { award: vi.fn().mockResolvedValue(true) };
  const sessions = { qualifiesForReturnAchievement: vi.fn().mockResolvedValue(returned) };
  return { listener: new AchievementEventsListener(achievements as never, sessions as never), achievements };
}

describe("AchievementEventsListener", () => {
  it("maps every non-session V1 trigger to its permanent achievement id", async () => {
    const { listener, achievements } = setup();
    const now = new Date("2026-08-18T10:00:00Z");
    await listener.onPlanCreated({ userId: "u", createdAt: now });
    await listener.onVisionBoardSaved({ userId: "u", savedAt: now });
    await listener.onStreakMilestone({ userId: "u", milestone: 7 });
    await listener.onStreakMilestone({ userId: "u", milestone: 30 });
    await listener.onPlanAdapted({ userId: "u", adaptedAt: now });
    await listener.onMockExamCreated({ userId: "u", createdAt: now });
    await listener.onNotebookReviewed({ userId: "u", reviewedAt: now });
    await listener.onWeeklyReview({ userId: "u", completedAt: now });
    await listener.onThreadPosted({ authorId: "u" } as never);
    await listener.onHelpfulVote({ recipientId: "u" } as never);
    expect(achievements.award.mock.calls.map((call) => call[1])).toEqual([
      "route_drawn", "dream_space_created", "rhythm_found", "rhythm_kept",
      "route_renewed", "starting_point_set", "mistake_revisited", "week_reflected",
      "first_hello", "helped_someone",
    ]);
  });

  it("awards return only after the seven-full-day evidence check", async () => {
    const startedAt = new Date("2026-08-18T10:00:00Z");
    const positive = setup(true);
    await positive.listener.onSessionCompleted({ userId: "u", startedAt });
    expect(positive.achievements.award.mock.calls.map((call) => call[1])).toEqual([
      "first_step",
      "returned_to_path",
    ]);

    const negative = setup(false);
    await negative.listener.onSessionCompleted({ userId: "u", startedAt });
    expect(negative.achievements.award).toHaveBeenCalledTimes(1);
    expect(negative.achievements.award).toHaveBeenCalledWith("u", "first_step", startedAt);
  });
});
