import { describe, expect, it, vi } from "vitest";
import { CoachFeedbackStatsService } from "./coach-feedback-stats.service";

describe("CoachFeedbackStatsService", () => {
  it("computes the satisfaction rate and passes through the 👎 list", async () => {
    const feedbackCounts = vi.fn(async () => ({ up: 3, down: 1, rated: 4 }));
    const listDownrated = vi.fn(async () => [
      { id: "m1", userId: "u1", question: "Nasıl?", reply: "Belirsiz yanıt", createdAt: "t" },
    ]);
    const service = new CoachFeedbackStatsService({ feedbackCounts, listDownrated } as never);

    const stats = await service.getFeedbackStats();

    expect(stats.satisfactionRate).toBe(0.75);
    expect(stats.rated).toBe(4);
    expect(stats.downrated[0]?.question).toBe("Nasıl?");
    expect(listDownrated).toHaveBeenCalledWith(20);
    expect(typeof stats.generatedAt).toBe("string");
  });

  it("returns null satisfaction rate when nothing is rated", async () => {
    const service = new CoachFeedbackStatsService({
      feedbackCounts: vi.fn(async () => ({ up: 0, down: 0, rated: 0 })),
      listDownrated: vi.fn(async () => []),
    } as never);

    const stats = await service.getFeedbackStats();

    expect(stats.satisfactionRate).toBeNull();
    expect(stats.downrated).toEqual([]);
  });
});
