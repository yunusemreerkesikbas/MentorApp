import { describe, expect, it } from "vitest";

import { getDefaultReactionChange, getReactionSummary } from "./reaction-summary";

describe("getReactionSummary", () => {
  it("returns an empty summary when every reaction count is zero", () => {
    expect(getReactionSummary({ "❤️": 0, "👍": 0 })).toEqual({
      hasReactions: false,
      total: 0,
      emojis: [],
    });
  });

  it("returns active emojis in the product palette order and sums their counts", () => {
    expect(getReactionSummary({ "🎉": 2, "❤️": 3, "👍": 1 })).toEqual({
      hasReactions: true,
      total: 6,
      emojis: ["❤️", "👍", "🎉"],
    });
  });

  it("ignores unsupported and negative reaction counts", () => {
    expect(getReactionSummary({ "❤️": -1, "🤬": 12, "💪": 2 })).toEqual({
      hasReactions: true,
      total: 2,
      emojis: ["💪"],
    });
  });
});

describe("getDefaultReactionChange", () => {
  it("adds the default heart when the viewer has no reaction", () => {
    expect(getDefaultReactionChange(null)).toEqual({ nextEmoji: "❤️", previousEmoji: null });
  });

  it("removes an existing heart and replaces another reaction with heart", () => {
    expect(getDefaultReactionChange("❤️")).toEqual({ nextEmoji: null, previousEmoji: "❤️" });
    expect(getDefaultReactionChange("👍")).toEqual({ nextEmoji: "❤️", previousEmoji: "👍" });
  });
});
