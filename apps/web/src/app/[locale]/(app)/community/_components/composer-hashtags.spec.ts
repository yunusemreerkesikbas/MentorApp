import { describe, expect, it } from "vitest";
import type { ForumTagView } from "@mentor/types";

import {
  collectSuggestedTagIds,
  filterHashtagSuggestions,
  getActiveHashtagToken,
  replaceHashtagToken,
} from "./composer-hashtags";

const tags: ForumTagView[] = [
  { id: "math", slug: "matematik", name: "Matematik", examType: null, isActive: true },
  { id: "turkish", slug: "turkce", name: "Türkçe", examType: null, isActive: true },
  { id: "history", slug: "tarih", name: "Tarih", examType: null, isActive: true },
  { id: "inactive", slug: "geometri", name: "Geometri", examType: null, isActive: false },
];

describe("composer hashtag helpers", () => {
  it("finds the hashtag token around the caret without matching an embedded hash", () => {
    expect(getActiveHashtagToken("Bugün #mate çalışacağım", 9)).toEqual({
      query: "ma",
      start: 6,
      end: 11,
    });
    expect(getActiveHashtagToken("konu#mate", 9)).toBeNull();
  });

  it("filters active suggestions by localized name or slug", () => {
    expect(filterHashtagSuggestions(tags, "tur").map((tag) => tag.id)).toEqual(["turkish"]);
    expect(filterHashtagSuggestions(tags, "geo")).toEqual([]);
  });

  it("replaces only the active token with the stable tag slug", () => {
    expect(
      replaceHashtagToken("Bugün #mate çalışacağım", { query: "ma", start: 6, end: 11 }, tags[0]!),
    ).toEqual({ value: "Bugün #matematik çalışacağım", caret: 16 });
    expect(
      replaceHashtagToken("#mat", { query: "mat", start: 0, end: 4 }, tags[0]!),
    ).toEqual({ value: "#matematik ", caret: 11 });
  });

  it("maps only known body hashtags to unique tag ids and respects the three-tag limit", () => {
    expect(
      collectSuggestedTagIds("#matematik #bilinmeyen #turkce #matematik #tarih #dorduncu", tags),
    ).toEqual(["math", "turkish", "history"]);
  });
});
