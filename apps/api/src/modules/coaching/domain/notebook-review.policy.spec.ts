import { describe, expect, it } from "vitest";
import {
  NOTEBOOK_REVIEW_LADDER_DAYS,
  advanceReview,
  firstReviewAt,
} from "./notebook-review.policy";

const NOW = new Date("2026-08-14T09:00:00.000Z");
const daysFromNow = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

describe("notebook review ladder", () => {
  it("schedules the first review at the bottom rung", () => {
    expect(firstReviewAt(NOW)).toEqual(daysFromNow(NOTEBOOK_REVIEW_LADDER_DAYS[0]));
  });

  it("climbs a rung on each success", () => {
    const first = advanceReview(0, true, NOW);
    expect(first).toEqual({
      nextReviewAt: daysFromNow(NOTEBOOK_REVIEW_LADDER_DAYS[1]!),
      status: "ACTIVE",
      reviewCount: 1,
    });

    const second = advanceReview(1, true, NOW);
    expect(second).toEqual({
      nextReviewAt: daysFromNow(NOTEBOOK_REVIEW_LADDER_DAYS[2]!),
      status: "ACTIVE",
      reviewCount: 2,
    });
  });

  it("heals off the top rung and leaves the due query", () => {
    const healed = advanceReview(NOTEBOOK_REVIEW_LADDER_DAYS.length - 1, true, NOW);
    expect(healed.status).toBe("HEALED");
    expect(healed.nextReviewAt).toBeNull();
  });

  it("resets to the bottom rung on a relapse, however high the card had climbed", () => {
    const relapsed = advanceReview(2, false, NOW);
    expect(relapsed).toEqual({
      nextReviewAt: daysFromNow(NOTEBOOK_REVIEW_LADDER_DAYS[0]!),
      status: "ACTIVE",
      reviewCount: 0,
    });
  });
});
