import { describe, expect, it } from "vitest";

import { readFeedContentFilter, toForumFeedContentQuery } from "./feed-content-filter";

describe("toForumFeedContentQuery", () => {
  it("omits the API filter for all and maps the visible content chips", () => {
    expect(toForumFeedContentQuery("all")).toEqual({});
    expect(toForumFeedContentQuery("posts")).toEqual({ contentType: "posts" });
    expect(toForumFeedContentQuery("questions")).toEqual({ contentType: "questions" });
  });

  it("asks for other people's unanswered questions under 'Cevap bekleyen'", () => {
    expect(toForumFeedContentQuery("waiting")).toEqual({ contentType: "questions", unanswered: true });
  });
});

describe("readFeedContentFilter", () => {
  it("opens the chip a deep link names and falls back to all", () => {
    expect(readFeedContentFilter("waiting")).toBe("waiting");
    expect(readFeedContentFilter("questions")).toBe("questions");
    expect(readFeedContentFilter(null)).toBe("all");
    expect(readFeedContentFilter("anything")).toBe("all");
  });
});
