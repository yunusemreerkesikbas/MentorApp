import { describe, expect, it } from "vitest";
import {
  SWIPE_FLICK_MIN_PX,
  SWIPE_THRESHOLD_PX,
  SWIPE_VELOCITY_PX_PER_S,
  bySubject,
  nextUnansweredIndex,
  reviewFeedback,
  swipeVerdict,
} from "./notebook-review-deck";

/** Well under every threshold — a drag that should never answer on its own. */
const SLOW = 0;

describe("swipeVerdict", () => {
  it("answers on distance alone, in the direction travelled", () => {
    expect(swipeVerdict(SWIPE_THRESHOLD_PX, SLOW)).toBe("solved");
    expect(swipeVerdict(-SWIPE_THRESHOLD_PX, SLOW)).toBe("missed");
  });

  it("leaves a short drag unanswered", () => {
    expect(swipeVerdict(SWIPE_THRESHOLD_PX - 1, SLOW)).toBeNull();
    expect(swipeVerdict(-(SWIPE_THRESHOLD_PX - 1), SLOW)).toBeNull();
    expect(swipeVerdict(0, SLOW)).toBeNull();
  });

  it("answers a fast flick before it reaches the distance threshold", () => {
    expect(swipeVerdict(SWIPE_FLICK_MIN_PX, SWIPE_VELOCITY_PX_PER_S)).toBe(
      "solved",
    );
    expect(swipeVerdict(-SWIPE_FLICK_MIN_PX, -SWIPE_VELOCITY_PX_PER_S)).toBe(
      "missed",
    );
  });

  it("ignores a fast twitch that never travelled — the tail of a tap", () => {
    expect(
      swipeVerdict(SWIPE_FLICK_MIN_PX - 1, SWIPE_VELOCITY_PX_PER_S * 4),
    ).toBeNull();
  });

  it("ignores a flick being reeled back in", () => {
    // Card is 60px to the right but travelling left at speed: the student is cancelling.
    expect(swipeVerdict(60, -SWIPE_VELOCITY_PX_PER_S * 2)).toBeNull();
  });

  it("still answers a far drag that is being pulled back", () => {
    // Past the distance threshold the gesture already read as an answer; velocity cannot undo it.
    expect(
      swipeVerdict(SWIPE_THRESHOLD_PX + 40, -SWIPE_VELOCITY_PX_PER_S),
    ).toBe("solved");
  });
});

describe("nextUnansweredIndex", () => {
  const deck = ["a", "b", "c", "d"];

  it("walks forward to the next card that has no answer yet", () => {
    expect(nextUnansweredIndex(deck, new Set(), 0)).toBe(1);
    expect(nextUnansweredIndex(deck, new Set(["b"]), 0)).toBe(2);
  });

  it("wraps back for a card the student jumped past", () => {
    // They started at "c", answered it, and "a"/"b" are still waiting at the top of the deck.
    expect(nextUnansweredIndex(deck, new Set(["c", "d"]), 2)).toBe(0);
  });

  it("ends the deck only when every card has been answered", () => {
    expect(nextUnansweredIndex(deck, new Set(["a", "b", "c"]), 2)).toBe(3);
    expect(nextUnansweredIndex(deck, new Set(deck), 2)).toBe(-1);
  });

  it("survives an index past the end of the deck", () => {
    expect(nextUnansweredIndex(deck, new Set(["a"]), 99)).toBe(1);
    expect(nextUnansweredIndex([], new Set(), 0)).toBe(-1);
  });
});

describe("bySubject", () => {
  const card = (id: string, subjectName: string | null) => ({
    id,
    subjectName,
  });

  it("groups a subject's cards together without reordering within the group", () => {
    expect(
      bySubject([
        card("a", "Matematik"),
        card("b", "Tarih"),
        card("c", "Matematik"),
        card("d", "Tarih"),
      ]).map((entry) => entry.id),
    ).toEqual(["a", "c", "b", "d"]);
  });

  it("keeps first-seen subject order and gives the unlabelled ones their own group", () => {
    expect(
      bySubject([
        card("a", "Tarih"),
        card("b", null),
        card("c", "Matematik"),
        card("d", null),
        card("e", "Tarih"),
      ]).map((entry) => entry.id),
    ).toEqual(["a", "e", "b", "d", "c"]);
  });
});

describe("reviewFeedback", () => {
  const NOW = new Date("2026-08-22T09:00:00.000Z");
  const inDays = (days: number) =>
    new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  it("quotes the days the server actually scheduled", () => {
    expect(
      reviewFeedback({ status: "ACTIVE", nextReviewAt: inDays(7) }, NOW),
    ).toEqual({ kind: "due", days: 7 });
  });

  it("reports a healed card instead of a date it no longer has", () => {
    expect(
      reviewFeedback({ status: "HEALED", nextReviewAt: null }, NOW),
    ).toEqual({ kind: "healed" });
  });

  it("says nothing when the card is due again today or already overdue", () => {
    expect(
      reviewFeedback({ status: "ACTIVE", nextReviewAt: inDays(0) }, NOW),
    ).toBeNull();
    expect(
      reviewFeedback({ status: "ACTIVE", nextReviewAt: inDays(-3) }, NOW),
    ).toBeNull();
  });

  it("says nothing for an active card with no schedule at all", () => {
    expect(
      reviewFeedback({ status: "ACTIVE", nextReviewAt: null }, NOW),
    ).toBeNull();
  });

  it("rounds across a clock that is a few hours off the exact interval", () => {
    // The ladder stores "now + 2 days"; the student reads it 3 hours later.
    const stored = new Date(
      NOW.getTime() + 2 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const later = new Date(NOW.getTime() + 3 * 60 * 60 * 1000);
    expect(
      reviewFeedback({ status: "ACTIVE", nextReviewAt: stored }, later),
    ).toEqual({
      kind: "due",
      days: 2,
    });
  });
});
