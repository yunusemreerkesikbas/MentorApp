"use client";

import { useEffect, useState } from "react";
import type { NotebookContentsDto } from "@mentor/types";
import { prefetchNotebookContents } from "@/lib/notebook-contents-cache";

/**
 * The contents page's data, read each time the book is turned back to it: pages written since the
 * last visit belong in it. The read is shared with the desk's prefetch, so a notebook that was just
 * clicked on the desk opens on contents that are already here.
 */
export function useNotebookContents(notebookId: string | undefined, showing: boolean) {
  const [state, setState] = useState<{
    contents: NotebookContentsDto | null;
    failed: boolean;
  }>({ contents: null, failed: false });

  useEffect(() => {
    if (!showing) return;
    let active = true;
    prefetchNotebookContents(notebookId)
      .then((contents) => {
        if (active) setState({ contents, failed: false });
      })
      .catch(() => {
        if (active) setState((current) => ({ ...current, failed: current.contents === null }));
      });
    return () => {
      active = false;
    };
  }, [notebookId, showing]);

  return state;
}
