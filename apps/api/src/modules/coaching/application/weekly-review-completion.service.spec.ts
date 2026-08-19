import { describe, expect, it, vi } from "vitest";
import { CoachingEventTopic } from "../domain/coaching.events";
import { WeeklyReviewCompletionService } from "./weekly-review-completion.service";

const input = { examId: "11111111-1111-4111-8111-111111111111", weekStart: "2026-08-10" };
const completedAt = new Date("2026-08-17T08:00:00Z");

function setup(status: "READY" | "PARTIAL" = "READY", inserted = true) {
  const reviews = {
    getReview: vi.fn().mockResolvedValue({ status, period: { startDate: input.weekStart } }),
  };
  const completions = {
    upsert: vi.fn().mockResolvedValue({
      inserted,
      row: { examId: input.examId, weekStart: input.weekStart, completedAt },
    }),
  };
  const events = { emit: vi.fn() };
  return {
    service: new WeeklyReviewCompletionService(reviews as never, completions as never, events as never),
    reviews,
    completions,
    events,
  };
}

describe("WeeklyReviewCompletionService", () => {
  it("rejects a review that is not READY", async () => {
    const { service, completions } = setup("PARTIAL");
    await expect(service.complete("user-1", input)).rejects.toMatchObject({
      details: { reason: "weekly_review_not_ready" },
    });
    expect(completions.upsert).not.toHaveBeenCalled();
  });

  it("emits the achievement signal only for the first completion", async () => {
    const { service, events } = setup("READY", true);
    await service.complete("user-1", input);
    expect(events.emit).toHaveBeenCalledWith(
      CoachingEventTopic.WEEKLY_REVIEW_COMPLETED,
      expect.objectContaining({ userId: "user-1", completedAt }),
    );
  });

  it("is idempotent when the week was already completed", async () => {
    const { service, events } = setup("READY", false);
    await expect(service.complete("user-1", input)).resolves.toEqual({
      ...input,
      completedAt: completedAt.toISOString(),
    });
    expect(events.emit).not.toHaveBeenCalled();
  });
});
