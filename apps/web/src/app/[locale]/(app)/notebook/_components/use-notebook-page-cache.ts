"use client";

import { useCallback, useRef } from "react";
import type { NotebookPageDto } from "@mentor/types";
import { NOTEBOOK_MAX_PAGES } from "@mentor/validation";
import { fetchNotebookPage } from "@/lib/notebook";

/**
 * The pages around the one that is open, read ahead.
 *
 * A page that turns shows its back and uncovers the next one, so the turn needs both of those
 * pages before it starts, not after. They are read as soon as a spread opens (`prefetchAround`) and
 * kept here; turning then never waits, and the editor shows the new spread in the same frame the
 * turn ends on instead of the old one until a request comes back.
 *
 * The open pages themselves are written back in (`put`) whenever the book is turned away from them,
 * edits included: that copy is newer than anything the server has until autosave lands.
 */
export function useNotebookPageCache(notebookId?: string) {
  const pages = useRef(new Map<number, NotebookPageDto>());
  const inflight = useRef(new Map<number, Promise<NotebookPageDto>>());

  const get = useCallback(
    (index: number): NotebookPageDto | null => pages.current.get(index) ?? null,
    [],
  );

  const put = useCallback((page: NotebookPageDto) => {
    pages.current.set(page.pageIndex, page);
  }, []);

  const ensure = useCallback(
    (index: number): Promise<NotebookPageDto> | null => {
      if (index < 0 || index >= NOTEBOOK_MAX_PAGES) return null;
      const known = pages.current.get(index);
      if (known) return Promise.resolve(known);
      const pending = inflight.current.get(index);
      if (pending) return pending;
      const request = fetchNotebookPage(index, notebookId)
        .then((page) => {
          // A copy put back while this was in flight is newer than what the server sent.
          if (!pages.current.has(index)) pages.current.set(index, page);
          return pages.current.get(index) ?? page;
        })
        .finally(() => inflight.current.delete(index));
      inflight.current.set(index, request);
      return request;
    },
    [notebookId],
  );

  /** Reads ahead around the spread whose left page is `left`: the spreads on either side. */
  const prefetchAround = useCallback(
    (left: number) => {
      for (const index of [left - 2, left - 1, left + 2, left + 3]) {
        ensure(index)?.catch(() => undefined);
      }
    },
    [ensure],
  );

  return { get, put, ensure, prefetchAround };
}
