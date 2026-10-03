import type { NotebookContentsDto } from "@mentor/types";
import { fetchNotebookContents } from "./notebook";

/**
 * The contents page, fetched the moment a notebook is clicked on the desk.
 *
 * The book is in the air for about a second before its cover opens on that page, which is more
 * than long enough for the read to land: started on the click, the flying book opens on its real
 * contents, and the editor underneath picks up the same answer instead of asking again.
 *
 * Short-lived on purpose. The contents change whenever a page is written, so an entry only stands
 * in for "fresh" for a few seconds; after that the editor reads again.
 */

const FRESH_MS = 8_000;

interface Entry {
  at: number;
  promise: Promise<NotebookContentsDto>;
}

const entries = new Map<string, Entry>();

function cacheKey(notebookId?: string): string {
  return notebookId ?? "mistake";
}

export function prefetchNotebookContents(
  notebookId?: string,
): Promise<NotebookContentsDto> {
  const key = cacheKey(notebookId);
  const cached = entries.get(key);
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.promise;
  const promise = fetchNotebookContents(notebookId);
  entries.set(key, { at: Date.now(), promise });
  // A failed read must not be served to the next caller as if it were an answer.
  promise.catch(() => {
    if (entries.get(key)?.promise === promise) entries.delete(key);
  });
  return promise;
}

/** Drops the cached answer, after a page was written and the contents changed. */
export function forgetNotebookContents(notebookId?: string): void {
  entries.delete(cacheKey(notebookId));
}
