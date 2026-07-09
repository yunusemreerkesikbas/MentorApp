import { FORUM_MENTION_HANDLE_PATTERN } from "@mentor/types";

/**
 * @mention parsing (APP-018). Handles are usernames (`FORUM_MENTION_HANDLE_PATTERN`, shared with the
 * client highlighter). A mention must not be embedded in a larger word (so `email@user` /
 * `@toolong…25chars` don't match). Deduped + capped to bound notification fan-out per post.
 */
export const FORUM_MAX_MENTIONS = 10;

const MENTION_RE = new RegExp(`(?<![\\w])@(${FORUM_MENTION_HANDLE_PATTERN})(?![a-z0-9_])`, "gi");

/** Unique lowercase handles mentioned in `body` (order preserved), capped at FORUM_MAX_MENTIONS. */
export function extractMentions(body: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(MENTION_RE)) {
    const handle = m[1]!.toLowerCase();
    if (seen.has(handle)) continue;
    seen.add(handle);
    out.push(handle);
    if (out.length >= FORUM_MAX_MENTIONS) break;
  }
  return out;
}
