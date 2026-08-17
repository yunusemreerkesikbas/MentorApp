import { describe, expect, it } from "vitest";

import {
  getQuestionTagSuggestions,
  questionMarkdownToPlainText,
  rankQuestionTags,
  toggleQuestionTag,
} from "./question-composer-state";

describe("question composer state", () => {
  it("adds and removes curated tags while enforcing the three-tag limit", () => {
    expect(toggleQuestionTag([], "a")).toEqual(["a"]);
    expect(toggleQuestionTag(["a"], "a")).toEqual([]);
    expect(toggleQuestionTag(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
  });

  it("turns Markdown into a readable feed preview", () => {
    expect(
      questionMarkdownToPlainText(
        "## Çalışma planı\n\n**Her gün** 20 soru çöz.\n\n- Paragraf\n- Problem",
      ),
    ).toBe("Çalışma planı Her gün 20 soru çöz. Paragraf Problem");
  });

  it("shows six curated suggestions and filters with or without a hash prefix", () => {
    const tags = Array.from({ length: 8 }, (_, index) => ({
      id: String(index),
      name: index === 7 ? "Sınav Stratejisi" : `Etiket ${index}`,
      slug: index === 7 ? "sinav-stratejisi" : `etiket-${index}`,
    }));

    expect(getQuestionTagSuggestions(tags, "")).toHaveLength(6);
    expect(getQuestionTagSuggestions(tags, "#sınav")).toEqual([tags[7]]);
    expect(getQuestionTagSuggestions(tags, "strateji")).toEqual([tags[7]]);
  });

  it("puts currently trending tags before the remaining curated tags", () => {
    const tags = [
      { id: "a", name: "A", slug: "a" },
      { id: "b", name: "B", slug: "b" },
      { id: "c", name: "C", slug: "c" },
    ];

    expect(rankQuestionTags(tags, ["c", "a"]).map((tag) => tag.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
});
