export const COMMUNITY_SEARCH_HISTORY_KEY = "mentor.community.recent-searches.v1";

export function normalizeRecentSearches(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const searches: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const query = item.trim();
    const key = query.toLocaleLowerCase();
    if (!query || seen.has(key)) continue;
    seen.add(key);
    searches.push(query);
    if (searches.length === 5) break;
  }
  return searches;
}

export function addRecentSearch(current: string[], query: string): string[] {
  return normalizeRecentSearches([query, ...current]);
}
