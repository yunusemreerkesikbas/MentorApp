"use client";

import { useCallback, useMemo, useReducer } from "react";
import type { VisionBoardDoc, VisionBoardItem } from "@mentor/types";

/**
 * Editor state: the document plus an undo/redo history.
 *
 * Boards are small (60 items max, capped by the schema), so history holds whole documents rather
 * than diffs — structural sharing would be machinery bought for a list that never gets long.
 */

const HISTORY_LIMIT = 30;

export interface BoardState {
  doc: VisionBoardDoc;
  selectedId: string | null;
  past: VisionBoardDoc[];
  future: VisionBoardDoc[];
  /** True once the document differs from what the server last acknowledged. */
  dirty: boolean;
}

export type BoardAction =
  | { type: "select"; id: string | null }
  /** Snapshot the document before a gesture starts; the gesture itself then patches transiently. */
  | { type: "checkpoint" }
  | { type: "add"; item: VisionBoardItem }
  | { type: "patch"; id: string; patch: Partial<VisionBoardItem>; transient?: boolean }
  | { type: "remove"; id: string }
  | { type: "bringToFront"; id: string }
  | { type: "sendToBack"; id: string }
  | { type: "setFrame"; frame: VisionBoardDoc["frame"] }
  | { type: "setBackground"; background: VisionBoardDoc["background"] }
  | { type: "setStatus"; status: VisionBoardDoc["status"] }
  | { type: "replace"; doc: VisionBoardDoc }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "saved" };

/** Push the current document onto the undo stack and drop any redo branch. */
function commit(state: BoardState, doc: VisionBoardDoc): BoardState {
  return {
    ...state,
    doc,
    past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
    future: [],
    dirty: true,
  };
}

function mapItems(
  doc: VisionBoardDoc,
  fn: (item: VisionBoardItem) => VisionBoardItem,
): VisionBoardDoc {
  return { ...doc, items: doc.items.map(fn) };
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "select":
      return { ...state, selectedId: action.id };

    /*
     * Taken on the first pointer move of a gesture, never on pointer-up. By the time the pointer
     * lifts, `state.doc` already holds the final position — pushing that onto the undo stack would
     * record "where it ended" and make undo a no-op. The pre-gesture document is the only useful
     * snapshot, and the first move is the last moment it still exists.
     */
    case "checkpoint":
      return {
        ...state,
        past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
        future: [],
      };

    case "add":
      return {
        ...commit(state, { ...state.doc, items: [...state.doc.items, action.item] }),
        selectedId: action.item.id,
      };

    case "patch": {
      const next = mapItems(state.doc, (item) =>
        item.id === action.id ? ({ ...item, ...action.patch } as VisionBoardItem) : item,
      );
      /*
       * A drag fires a patch per pointer move. Recording each one would fill the 30-step history
       * with a single gesture and make undo walk back pixel by pixel, so the gesture patches
       * transiently and commits once on pointer-up.
       */
      if (action.transient) return { ...state, doc: next, dirty: true };
      return commit(state, next);
    }

    case "remove":
      return {
        ...commit(state, {
          ...state.doc,
          items: state.doc.items.filter((item) => item.id !== action.id),
        }),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };

    case "bringToFront": {
      const top = state.doc.items.reduce((max, item) => Math.max(max, item.z), 0);
      return commit(
        state,
        mapItems(state.doc, (item) =>
          item.id === action.id ? { ...item, z: top + 1 } : item,
        ),
      );
    }

    case "sendToBack": {
      const bottom = state.doc.items.reduce(
        (min, item) => Math.min(min, item.z),
        Number.POSITIVE_INFINITY,
      );
      // z is a non-negative int in the schema, so sinking below zero is not an option: everything
      // else moves up instead.
      if (bottom <= 0) {
        return commit(
          state,
          mapItems(state.doc, (item) =>
            item.id === action.id ? { ...item, z: 0 } : { ...item, z: item.z + 1 },
          ),
        );
      }
      return commit(
        state,
        mapItems(state.doc, (item) =>
          item.id === action.id ? { ...item, z: bottom - 1 } : item,
        ),
      );
    }

    case "setFrame":
      return commit(state, { ...state.doc, frame: action.frame });

    case "setBackground":
      return commit(state, { ...state.doc, background: action.background });

    case "setStatus":
      return commit(state, { ...state.doc, status: action.status });

    case "replace":
      return commit(state, action.doc);

    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        ...state,
        doc: previous,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future].slice(0, HISTORY_LIMIT),
        selectedId: null,
        dirty: true,
      };
    }

    case "redo": {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return {
        ...state,
        doc: next,
        past: [...state.past, state.doc].slice(-HISTORY_LIMIT),
        future: rest,
        selectedId: null,
        dirty: true,
      };
    }

    case "saved":
      return { ...state, dirty: false };

    default:
      return state;
  }
}

export function initialBoardState(doc: VisionBoardDoc, dirty = false): BoardState {
  return { doc, selectedId: null, past: [], future: [], dirty };
}

export function useBoardReducer(initial: VisionBoardDoc, dirty = false) {
  const [state, dispatch] = useReducer(boardReducer, initial, (doc) =>
    initialBoardState(doc, dirty),
  );

  const selected = useMemo(
    () => state.doc.items.find((item) => item.id === state.selectedId) ?? null,
    [state.doc.items, state.selectedId],
  );

  const patchSelected = useCallback(
    (patch: Partial<VisionBoardItem>, transient = false) => {
      if (!state.selectedId) return;
      dispatch({ type: "patch", id: state.selectedId, patch, transient });
    },
    [state.selectedId],
  );

  return {
    state,
    dispatch,
    selected,
    patchSelected,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
