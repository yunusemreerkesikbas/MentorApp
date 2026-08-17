import type { ForumFeedScope, ForumFeedSort } from "@mentor/types";

export type FeedTab = "featured" | "recent" | "top" | "following";

export function feedTabToQuery(tab: FeedTab): {
  scope: ForumFeedScope;
  sort: ForumFeedSort;
} {
  if (tab === "following") return { scope: "following", sort: "recent" };
  if (tab === "recent") return { scope: "relevant", sort: "recent" };
  if (tab === "top") return { scope: "relevant", sort: "top" };
  return { scope: "relevant", sort: "trending" };
}

export function feedQueryToTab(
  scope: ForumFeedScope,
  sort: ForumFeedSort,
): FeedTab {
  if (scope === "following") return "following";
  if (sort === "recent") return "recent";
  if (sort === "top") return "top";
  return "featured";
}
