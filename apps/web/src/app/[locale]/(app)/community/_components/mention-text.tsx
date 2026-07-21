"use client";

import type { ReactNode } from "react";
import { FORUM_MENTION_HANDLE_PATTERN } from "@mentor/types";
import { Link } from "@/i18n/navigation";

// Match @handle not embedded in a larger word. Group 1 = the preceding boundary char (or "" at start),
// group 2 = the @handle. Lookahead only (no lookbehind) → safe across browsers. Handle pattern is
// shared with the server parser (`forum/domain/mention.ts`) via @mentor/types.
const MENTION_RE = new RegExp(`(^|[^\\w])(@${FORUM_MENTION_HANDLE_PATTERN})(?![a-z0-9_])`, "gi");

/**
 * Renders post/comment body text with @mentions highlighted and linked to the mentioned user's forum
 * profile. Plain text is preserved verbatim so the parent's `whitespace-pre-wrap` / `break-words` still
 * apply; the mention link stops propagation so it never triggers a clickable feed row's navigation.
 */
export function MentionText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(MENTION_RE)) {
    const handleStart = m.index! + m[1]!.length;
    if (handleStart > last) nodes.push(text.slice(last, handleStart));
    const handle = m[2]!.slice(1); // drop the leading '@'
    nodes.push(
      <Link
        key={key++}
        href={{
          pathname: "/community/member/[username]",
          params: { username: handle },
        }}
        onClick={(e) => e.stopPropagation()}
        className="font-medium hover:underline"
        style={{ color: "var(--color-accent)" }}
      >
        {m[2]}
      </Link>,
    );
    last = handleStart + m[2]!.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}
