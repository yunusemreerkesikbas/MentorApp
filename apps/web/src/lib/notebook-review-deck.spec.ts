import { describe, expect, it } from "vitest";
import {
  SWIPE_FLICK_MIN_PX,
  SWIPE_THRESHOLD_PX,
  SWIPE_VELOCITY_PX_PER_S,
  nextUnansweredIndex,
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
    expect(swipeVerdict(SWIPE_THRESHOLD_PX + 40, -SWIPE_VELOCITY_PX_PER_S)).toBe(
      "solved",
    );
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
