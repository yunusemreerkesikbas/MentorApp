"use client";

import { useEffect, useState } from "react";
import type { NotebookContentsDto } from "@mentor/types";
import { prefetchNotebookContents } from "@/lib/notebook-contents-cache";

interface ContentsState {
  /** Whose contents these are: an answer for another notebook is never shown for this one. */
  key: string;
  contents: NotebookContentsDto | null;
  failed: boolean;
}

/**
 * The contents page's data, read each time the book is turned back to it: pages written since the
 * last visit belong in it. The read is shared with the desk's prefetch, so a notebook that was just
 * clicked on the desk opens on contents that are already here.
 */
export function useNotebookContents(notebookId: string | undefined, showing: boolean) {
  const key = notebookId ?? "mistake";
  const [state, setState] = useState<ContentsState>({ key, contents: null, failed: false });

  useEffect(() => {
    if (!showing) return;
    let active = true;
    prefetchNotebookContents(notebookId)
      .then((contents) => {
        if (active) setState({ key, contents, failed: false });
      })
      .catch(() => {
        if (!active) return;
        setState((current) =>
          current.key === key
            ? { ...current, failed: current.contents === null }
            : { key, contents: null, failed: true },
        );
      });
    return () => {
      active = false;
    };
  }, [key, notebookId, showing]);

  return state.key === key
    ? { contents: state.contents, failed: state.failed }
    : { contents: null, failed: false };
}
