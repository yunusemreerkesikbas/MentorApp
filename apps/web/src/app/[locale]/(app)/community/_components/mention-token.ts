/**
 * Caret-anchored @mention token detection (APP-021). Pure — shared by the autocomplete hook and
 * unit-testable without a DOM. Boundary rules mirror `MentionText` / the server parser: the `@`
 * must not be embedded in a larger word (so `email@x` never triggers).
 */
export interface MentionToken {
  /** Lowercased prefix typed after `@` (≥1 char). */
  query: string;
  /** Index of the `@` character in the value. */
  start: number;
  /** End of the handle run (past-the-caret tail included, so selecting replaces the whole token). */
  end: number;
}

const HANDLE_CHAR = /[a-zA-Z0-9_]/;
const MAX_QUERY = 24;

/** The @token the caret is currently inside/behind, or null when autocomplete shouldn't open. */
export function getActiveMentionToken(value: string, caret: number): MentionToken | null {
  // Walk back from the caret over handle chars to find the `@`.
  let at = -1;
  for (let i = caret - 1; i >= 0; i--) {
    const ch = value[i]!;
    if (ch === "@") {
      at = i;
      break;
    }
    if (!HANDLE_CHAR.test(ch)) return null;
  }
  if (at < 0) return null;
  // `@` embedded in a larger word (e.g. an email's local part) is not a mention.
  if (at > 0 && /[\w@]/.test(value[at - 1]!)) return null;
  // Extend past the caret so selecting a suggestion replaces the whole half-typed handle.
  let end = caret;
  while (end < value.length && HANDLE_CHAR.test(value[end]!)) end++;
  const query = value.slice(at + 1, caret).toLowerCase();
  if (query.length < 1 || query.length > MAX_QUERY) return null;
  return { query, start: at, end };
}
