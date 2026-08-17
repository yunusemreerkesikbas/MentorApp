export const QUESTION_TAG_LIMIT = 3;
export const QUESTION_TAG_SUGGESTION_LIMIT = 6;

export function rankQuestionTags<T extends { id: string }>(
  tags: T[],
  trendingTagIds: string[],
): T[] {
  const byId = new Map(tags.map((tag) => [tag.id, tag]));
  const trending = trendingTagIds.flatMap((id) => {
    const tag = byId.get(id);
    if (!tag) return [];
    byId.delete(id);
    return [tag];
  });
  return [...trending, ...byId.values()];
}

export function getQuestionTagSuggestions<
  T extends { name: string; slug: string },
>(tags: T[], query: string): T[] {
  const normalizedQuery = query
    .trim()
    .replace(/^#+/, "")
    .toLocaleLowerCase();
  const matches = normalizedQuery
    ? tags.filter((tag) =>
        `${tag.name} ${tag.slug}`.toLocaleLowerCase().includes(normalizedQuery),
      )
    : tags;
  return matches.slice(0, QUESTION_TAG_SUGGESTION_LIMIT);
}

export function toggleQuestionTag(selected: string[], tagId: string): string[] {
  if (selected.includes(tagId)) return selected.filter((id) => id !== tagId);
  if (selected.length >= QUESTION_TAG_LIMIT) return selected;
  return [...selected, tagId];
}

export function questionMarkdownToPlainText(markdown: string): string {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+\.)\s+/gm, "")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
