"use client";

import { useCallback, useReducer } from "react";
import type { NotebookPageDoc, NotebookPageItem } from "@mentor/types";

/**
 * Page document state: place, move, delete, undo.
 *
 * A separate, much smaller thing than `use-board-reducer`, on purpose. That reducer carries the
 * vision board's own vocabulary — frame, background, publish status — none of which a notebook page
 * has, and making it generic over both documents would cost more than the ~60 lines below.
 *
 * History is single-stack (undo, no redo). A notebook page is arranged in seconds, not composed
 * over a session; redo would be a button nobody presses.
 */

interface PageState {
  doc: NotebookPageDoc;
  past: NotebookPageDoc[];
  selectedId: string | null;
  /** True when the document differs from what the server last acknowledged. */
  dirty: boolean;
}

type PageAction =
  | { type: "replace"; doc: NotebookPageDoc }
  | { type: "checkpoint" }
  | { type: "add"; item: NotebookPageItem }
  | { type: "patch"; id: string; patch: Partial<NotebookPageItem> }
  | { type: "remove"; id: string }
  | { type: "select"; id: string | null }
  | { type: "setPaper"; paper: NotebookPageDoc["paper"] }
  | { type: "undo" }
  | { type: "saved" };

/** Bounded so a long editing session cannot grow the history without limit. */
const MAX_HISTORY = 30;

function pushHistory(state: PageState): NotebookPageDoc[] {
  return [...state.past, state.doc].slice(-MAX_HISTORY);
}

export function notebookPageReducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "replace":
      // Loading a page is not an edit — it resets history rather than becoming undoable.
      return { doc: action.doc, past: [], selectedId: null, dirty: false };

    case "checkpoint":
      return { ...state, past: pushHistory(state) };

    case "add":
      return {
        ...state,
        past: pushHistory(state),
        doc: { ...state.doc, items: [...state.doc.items, action.item] },
        selectedId: action.item.id,
        dirty: true,
      };

    /*
     * No checkpoint here: a drag fires this on every frame, and snapshotting each one would fill
     * the history with a hundred near-identical documents. The gesture takes exactly one checkpoint
     * when it starts moving.
     */
    case "patch":
      return {
        ...state,
        doc: {
          ...state.doc,
          items: state.doc.items.map((item) =>
            item.id === action.id
              ? ({ ...item, ...action.patch } as NotebookPageItem)
              : item,
          ),
        },
        dirty: true,
      };

    case "remove":
      return {
        ...state,
        past: pushHistory(state),
        doc: {
          ...state.doc,
          items: state.doc.items.filter((item) => item.id !== action.id),
        },
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        dirty: true,
      };

    case "select":
      return { ...state, selectedId: action.id };

    case "setPaper":
      return {
        ...state,
        past: pushHistory(state),
        doc: { ...state.doc, paper: action.paper },
        dirty: true,
      };

    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...state,
        doc: previous,
        past: state.past.slice(0, -1),
        // Selection can point at an item the undone document never had.
        selectedId: previous.items.some((item) => item.id === state.selectedId)
          ? state.selectedId
          : null,
        dirty: true,
      };
    }

    case "saved":
      return { ...state, dirty: false };
  }
}

export function useNotebookPage(initial: NotebookPageDoc) {
  const [state, dispatch] = useReducer(notebookPageReducer, {
    doc: initial,
    past: [],
    selectedId: null,
    dirty: false,
  });

  const patch = useCallback(
    (id: string, next: Partial<NotebookPageItem>) =>
      dispatch({ type: "patch", id, patch: next }),
    [],
  );
  const checkpoint = useCallback(() => dispatch({ type: "checkpoint" }), []);

  const selected =
    state.doc.items.find((item) => item.id === state.selectedId) ?? null;

  return {
    state,
    dispatch,
    patch,
    checkpoint,
    selected,
    canUndo: state.past.length > 0,
  };
}
