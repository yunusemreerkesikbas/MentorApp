export type FeedContentFilter = "all" | "posts" | "questions";

export function toForumFeedContentType(
  filter: FeedContentFilter,
): "posts" | "questions" | undefined {
  return filter === "all" ? undefined : filter;
}
