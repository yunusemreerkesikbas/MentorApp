import type { ForumTagView } from "@mentor/types";

export interface HashtagToken {
  query: string;
  start: number;
  end: number;
}

const HASHTAG_CHARACTER = /[\p{L}\p{N}_-]/u;
const HASHTAG_PATTERN = /(?:^|[\s([{"'])#([\p{L}\p{N}_-]+)/gu;
const MAX_SUGGESTIONS = 6;
const MAX_THREAD_TAGS = 3;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("tr");
}

export function getActiveHashtagToken(value: string, caret: number): HashtagToken | null {
  let hash = -1;
  for (let index = caret - 1; index >= 0; index--) {
    const character = value[index]!;
    if (character === "#") {
      hash = index;
      break;
    }
    if (!HASHTAG_CHARACTER.test(character)) return null;
  }
  if (hash < 0 || (hash > 0 && HASHTAG_CHARACTER.test(value[hash - 1]!))) return null;

  let end = caret;
  while (end < value.length && HASHTAG_CHARACTER.test(value[end]!)) end++;
  return { query: value.slice(hash + 1, caret), start: hash, end };
}

export function filterHashtagSuggestions(tags: ForumTagView[], query: string): ForumTagView[] {
  const normalizedQuery = normalize(query);
  return tags
    .filter(
      (tag) =>
        tag.isActive &&
        (normalize(tag.name).includes(normalizedQuery) || normalize(tag.slug).includes(normalizedQuery)),
    )
    .slice(0, MAX_SUGGESTIONS);
}

export function replaceHashtagToken(
  value: string,
  token: HashtagToken,
  tag: ForumTagView,
): { value: string; caret: number } {
  const needsTrailingSpace = token.end === value.length;
  const inserted = `#${tag.slug}${needsTrailingSpace ? " " : ""}`;
  return {
    value: value.slice(0, token.start) + inserted + value.slice(token.end),
    caret: token.start + inserted.length,
  };
}

export function collectSuggestedTagIds(body: string, tags: ForumTagView[]): string[] {
  const tagsBySlug = new Map(
    tags.filter((tag) => tag.isActive).map((tag) => [normalize(tag.slug), tag.id]),
  );
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const match of body.matchAll(HASHTAG_PATTERN)) {
    const id = tagsBySlug.get(normalize(match[1] ?? ""));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length === MAX_THREAD_TAGS) break;
  }
  return ids;
}
