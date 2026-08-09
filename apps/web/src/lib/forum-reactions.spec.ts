import { describe, expect, it } from "vitest";
import { replaceReaction } from "./forum-reactions";

describe("replaceReaction", () => {
  it("replaces the previous reaction and updates both counts", () => {
    expect(
      replaceReaction(
        { reactionCounts: { "❤️": 3, "💪": 1 }, myReactions: ["❤️"] },
        "💪",
      ),
    ).toEqual({ reactionCounts: { "❤️": 2, "💪": 2 }, myReactions: ["💪"] });
  });

  it("removes the current reaction", () => {
    expect(
      replaceReaction({ reactionCounts: { "❤️": 1 }, myReactions: ["❤️"] }, null),
    ).toEqual({ reactionCounts: {}, myReactions: [] });
  });
});
