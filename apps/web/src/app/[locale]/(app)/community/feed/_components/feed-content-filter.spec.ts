import { describe, expect, it } from "vitest";

import { toForumFeedContentType } from "./feed-content-filter";

describe("toForumFeedContentType", () => {
  it("omits the API filter for all and maps the two visible content tabs", () => {
    expect(toForumFeedContentType("all")).toBeUndefined();
    expect(toForumFeedContentType("posts")).toBe("posts");
    expect(toForumFeedContentType("questions")).toBe("questions");
  });
});
