import { describe, expect, it } from "vitest";
import {
  NOTEBOOK_REVIEW_LADDER_DAYS,
  advanceReview,
  firstReviewAt,
} from "./notebook-review.policy";

const NOW = new Date("2026-08-14T09:00:00.000Z");
const daysFromNow = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
/** Due an hour ago: every case below is a card answered on schedule unless it says otherwise. */
const DUE = new Date(NOW.getTime() - 60 * 60 * 1000);

describe("notebook review ladder", () => {
  it("schedules the first review at the bottom rung", () => {
    expect(firstReviewAt(NOW)).toEqual(
      daysFromNow(NOTEBOOK_REVIEW_LADDER_DAYS[0]),
    );
  });

  it("climbs a rung on each success", () => {
    const first = advanceReview({
      reviewCount: 0,
      solved: true,
      dueAt: DUE,
      status: "ACTIVE",
      now: NOW,
    });
    expect(first).toEqual({
      nextReviewAt: daysFromNow(NOTEBOOK_REVIEW_LADDER_DAYS[1]!),
      status: "ACTIVE",
      reviewCount: 1,
    });

    const second = advanceReview({
      reviewCount: 1,
      solved: true,
      dueAt: DUE,
      status: "ACTIVE",
      now: NOW,
    });
    expect(second).toEqual({
      nextReviewAt: daysFromNow(NOTEBOOK_REVIEW_LADDER_DAYS[2]!),
      status: "ACTIVE",
      reviewCount: 2,
    });
  });

  it("heals off the top rung and leaves the due query", () => {
    const healed = advanceReview({
      reviewCount: NOTEBOOK_REVIEW_LADDER_DAYS.length - 1,
      solved: true,
      dueAt: DUE,
      status: "ACTIVE",
      now: NOW,
    });
    expect(healed.status).toBe("HEALED");
    expect(healed.nextReviewAt).toBeNull();
  });

  it("resets to the bottom rung on a relapse, however high the card had climbed", () => {
    const relapsed = advanceReview({
      reviewCount: 2,
      solved: false,
      dueAt: DUE,
      status: "ACTIVE",
      now: NOW,
    });
    expect(relapsed).toEqual({
      nextReviewAt: daysFromNow(NOTEBOOK_REVIEW_LADDER_DAYS[0]!),
      status: "ACTIVE",
      reviewCount: 0,
    });
  });

  describe("answered before it was due", () => {
    const LATER = daysFromNow(5);

    it("does not climb the ladder — there was no gap to survive", () => {
      const outcome = advanceReview({
        reviewCount: 1,
        solved: true,
        dueAt: LATER,
        status: "ACTIVE",
        now: NOW,
      });
      // Otherwise a card can be walked to the top rung in an afternoon and called learned.
      expect(outcome).toEqual({
        nextReviewAt: LATER,
        status: "ACTIVE",
        reviewCount: 1,
      });
    });

    it("still costs the card its place when it is missed", () => {
      const outcome = advanceReview({
        reviewCount: 2,
        solved: false,
        dueAt: LATER,
        status: "ACTIVE",
        now: NOW,
      });
      // Finding out you cannot do it is real information whenever it arrives.
      expect(outcome).toEqual({
        nextReviewAt: daysFromNow(NOTEBOOK_REVIEW_LADDER_DAYS[0]!),
        status: "ACTIVE",
        reviewCount: 0,
      });
    });

    it("leaves an archived card out of the rotation, missed or not", () => {
      const outcome = advanceReview({
        reviewCount: 0,
        solved: false,
        dueAt: null,
        status: "ARCHIVED",
        now: NOW,
      });
      // The student took this card out deliberately; one answer in passing is not asking for it back.
      expect(outcome).toEqual({
        nextReviewAt: null,
        status: "ARCHIVED",
        reviewCount: 0,
      });
    });

    it("does not resurrect a healed card either", () => {
      const outcome = advanceReview({
        reviewCount: 3,
        solved: false,
        dueAt: null,
        status: "HEALED",
        now: NOW,
      });
      expect(outcome).toEqual({
        nextReviewAt: null,
        status: "HEALED",
        reviewCount: 3,
      });
    });
  });
});
