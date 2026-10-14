/** Akış content chips. "waiting" = "Cevap bekleyen": others' questions nobody has answered yet. */
export type FeedContentFilter = "all" | "posts" | "questions" | "waiting";

const FILTERS: readonly FeedContentFilter[] = ["all", "posts", "questions", "waiting"];

export function toForumFeedContentQuery(filter: FeedContentFilter): {
  contentType?: "posts" | "questions";
  unanswered?: boolean;
} {
  if (filter === "all") return {};
  if (filter === "waiting") return { contentType: "questions", unanswered: true };
  return { contentType: filter };
}

/** `?content=` deep links (Keşfet's "El uzat"); anything unknown is the default chip. */
export function readFeedContentFilter(value: string | null): FeedContentFilter {
  return FILTERS.find((filter) => filter === value) ?? "all";
}
