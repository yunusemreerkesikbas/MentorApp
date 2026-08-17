import { describe, expect, it } from "vitest";

import { feedQueryToTab, feedTabToQuery } from "./feed-tab-selection";

describe("feed tab selection", () => {
  it.each([
    ["featured", { scope: "relevant", sort: "trending" }],
    ["recent", { scope: "relevant", sort: "recent" }],
    ["top", { scope: "relevant", sort: "top" }],
    ["following", { scope: "following", sort: "recent" }],
  ] as const)("maps %s to the feed query", (tab, query) => {
    expect(feedTabToQuery(tab)).toEqual(query);
    expect(feedQueryToTab(query.scope, query.sort)).toBe(tab);
  });
});
