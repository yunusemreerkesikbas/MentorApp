"use client";

import { useCallback, useReducer } from "react";
import type {
  NotebookInkStroke,
  NotebookPageDoc,
  NotebookPageItem,
} from "@mentor/types";

/**
 * Page document state: place, move, delete, draw, undo, redo.
 *
 * A separate, much smaller thing than `use-board-reducer`, on purpose. That reducer carries the
 * vision board's own vocabulary — frame, background, publish status — none of which a notebook page
 * has, and making it generic over both documents would cost more than the lines below.
 *
 * History used to be a single stack, on the reasoning that a page is arranged in seconds and redo
 * would be a button nobody presses. Drawing changed that: arranging is a handful of deliberate
 * placements, but drawing is dozens of strokes a minute, and undoing three of them to rescue one
 * is an ordinary thing to want. So there is a redo stack now — and, as always, any new edit
 * discards it.
 */

interface PageState {
  doc: NotebookPageDoc;
  past: NotebookPageDoc[];
  future: NotebookPageDoc[];
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
  | { type: "addStroke"; stroke: NotebookInkStroke }
  | { type: "eraseStrokes"; ids: string[] }
  | { type: "clearInk" }
  | { type: "undo" }
  | { type: "redo" }
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
      return {
        doc: action.doc,
        past: [],
        future: [],
        selectedId: null,
        dirty: false,
      };

    /*
     * Every editing case below clears `future`. Undoing and then drawing something else makes the
     * branch you undid unreachable, and a redo button that resurrects it would drop a stroke into
     * a page that has moved on.
     */
    case "checkpoint":
      return { ...state, past: pushHistory(state), future: [] };

    case "add":
      return {
        ...state,
        past: pushHistory(state),
        future: [],
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
        future: [],
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
        future: [],
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
        future: [],
        doc: { ...state.doc, paper: action.paper },
        dirty: true,
      };

    /*
     * One checkpoint per finished stroke, unlike `patch`. A stroke is a whole gesture already —
     * the pointer plumbing accumulates samples in its own state and only reaches the reducer when
     * the pen lifts — so one undo step per stroke is exactly what a drawer expects.
     */
    case "addStroke":
      return {
        ...state,
        past: pushHistory(state),
        future: [],
        doc: { ...state.doc, ink: [...state.doc.ink, action.stroke] },
        dirty: true,
      };

    /*
     * The whole erase gesture, not one stroke per swipe. Dragging the eraser across five strokes
     * is one action to the person doing it, so it should be one undo.
     */
    case "eraseStrokes": {
      if (action.ids.length === 0) return state;
      const doomed = new Set(action.ids);
      const remaining = state.doc.ink.filter((stroke) => !doomed.has(stroke.id));
      // Erasing over blank paper is a no-op, not an undo step that appears to do nothing.
      if (remaining.length === state.doc.ink.length) return state;
      return {
        ...state,
        past: pushHistory(state),
        future: [],
        doc: { ...state.doc, ink: remaining },
        dirty: true,
      };
    }

    case "clearInk":
      if (state.doc.ink.length === 0) return state;
      return {
        ...state,
        past: pushHistory(state),
        future: [],
        doc: { ...state.doc, ink: [] },
        dirty: true,
      };

    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...state,
        doc: previous,
        past: state.past.slice(0, -1),
        future: [...state.future, state.doc].slice(-MAX_HISTORY),
        // Selection can point at an item the undone document never had.
        selectedId: previous.items.some((item) => item.id === state.selectedId)
          ? state.selectedId
          : null,
        dirty: true,
      };
    }

    case "redo": {
      const next = state.future.at(-1);
      if (!next) return state;
      return {
        ...state,
        doc: next,
        past: [...state.past, state.doc].slice(-MAX_HISTORY),
        future: state.future.slice(0, -1),
        // Same reason as undo, in the other direction.
        selectedId: next.items.some((item) => item.id === state.selectedId)
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
    future: [],
    selectedId: null,
    dirty: false,
  });

  const patch = useCallback(
    (id: string, next: Partial<NotebookPageItem>) =>
      dispatch({ type: "patch", id, patch: next }),
    [],
  );
  const checkpoint = useCallback(() => dispatch({ type: "checkpoint" }), []);
  // Referentially stable: `use-ink-draw` holds this across a whole gesture.
  const addStroke = useCallback(
    (stroke: NotebookInkStroke) => dispatch({ type: "addStroke", stroke }),
    [],
  );
  const eraseStrokes = useCallback(
    (ids: string[]) => dispatch({ type: "eraseStrokes", ids }),
    [],
  );

  const selected =
    state.doc.items.find((item) => item.id === state.selectedId) ?? null;

  return {
    state,
    dispatch,
    patch,
    checkpoint,
    addStroke,
    eraseStrokes,
    selected,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
