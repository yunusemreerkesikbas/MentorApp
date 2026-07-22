import { describe, expect, it, vi } from "vitest";
import { WeeklyReviewService } from "./weekly-review.service";

const fakeDb = {
  transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> =>
    cb({ execute: async () => undefined }),
} as never;

function makeService(completedSessions: number) {
  const sessions = Array.from({ length: completedSessions }, (_, index) => ({
    id: `s${index}`,
    actualFocusSeconds: 1500,
    endedAt: new Date(`2026-07-${15 + index}T10:00:00.000Z`),
    updatedAt: new Date(`2026-07-${15 + index}T10:30:00.000Z`),
  }));
  return new WeeklyReviewService(
    fakeDb,
    {
      getExamById: vi.fn(async () => ({ id: "exam" })),
      listExamSubjects: vi.fn(async () => []),
    } as never,
    {
      getEvidence: vi.fn(async () => ({
        exams: [],
        subjects: [],
        photos: [],
        sessions,
        moods: [],
      })),
    } as never,
    { translate: vi.fn((key: string) => key) } as never,
  );
}

describe("WeeklyReviewService suggested task", () => {
  it("returns null while the review is insufficient", async () => {
    const review = await makeService(0).getReview(
      "user",
      "exam",
      new Date("2026-07-22T10:00:00.000Z"),
    );
    expect(review.status).toBe("INSUFFICIENT");
    expect(review.suggestedTask).toBeNull();
  });

  it("returns a backend-localized task when the review is ready", async () => {
    const review = await makeService(2).getReview(
      "user",
      "exam",
      new Date("2026-07-22T10:00:00.000Z"),
    );
    expect(review.status).toBe("READY");
    expect(review.suggestedTask).toEqual({
      title: "coaching.weekly.TASK_SESSION",
      subject: null,
    });
  });
});
