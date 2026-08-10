import { describe, expect, it } from "vitest";

import { insertEmojiAtSelection } from "./insert-emoji";

describe("insertEmojiAtSelection", () => {
  it("inserts at the caret", () => {
    expect(insertEmojiAtSelection("Merhaba dünya", "🙂", 8, 8, 4000)).toEqual({
      value: "Merhaba 🙂dünya",
      caret: 10,
      inserted: true,
    });
  });

  it("replaces the selected text", () => {
    expect(insertEmojiAtSelection("çok güzel", "❤️", 4, 9, 4000)).toEqual({
      value: "çok ❤️",
      caret: 6,
      inserted: true,
    });
  });

  it("does not split an emoji when the limit is reached", () => {
    expect(insertEmojiAtSelection("1234", "🙂", 4, 4, 5)).toEqual({
      value: "1234",
      caret: 4,
      inserted: false,
    });
  });
});
