import { describe, expect, it } from "vitest";

import { feedQueryToTab, feedTabToQuery, readFeedTab } from "./feed-tab-selection";

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

  // Old Gündem links land on `?sort=top`; anything unknown opens the default tab.
  it.each([
    ["top", "top"],
    ["recent", "recent"],
    ["following", "following"],
    ["featured", "featured"],
    ["trending", "featured"],
    [null, "featured"],
  ] as const)("reads ?sort=%s as the %s tab", (value, tab) => {
    expect(readFeedTab(value)).toBe(tab);
  });
});
