import { describe, expect, it } from "vitest";

import { addRecentSearch, normalizeRecentSearches } from "./community-search-history";

describe("community search history", () => {
  it("keeps the latest five unique, trimmed queries", () => {
    expect(
      normalizeRecentSearches(["  Paragraf ", "Matematik", "paragraf", "YKS", "KPSS", "LGS", "TYT"]),
    ).toEqual(["Paragraf", "Matematik", "YKS", "KPSS", "LGS"]);
  });

  it("moves a repeated search to the front", () => {
    expect(addRecentSearch(["Matematik", "Paragraf"], " paragraf ")).toEqual([
      "paragraf",
      "Matematik",
    ]);
  });
});
