"use client";

import { useEffect, type Dispatch } from "react";
import type { VisionBoardItem } from "@mentor/types";
import { applyMove, nudgeDelta } from "@/components/stage/gesture-math";
import type { BoardAction } from "./use-board-reducer";

/**
 * The editor's keyboard: Escape steps back out of the panel, Cmd/Ctrl+Z walks the history, Delete
 * removes the selection and the arrows move it (Shift for the larger step). Typing in a field is
 * never a shortcut.
 */
export function useBoardShortcuts({
  selected,
  dispatch,
  onEscape,
}: {
  selected: VisionBoardItem | null;
  dispatch: Dispatch<BoardAction>;
  /** Returns true when it closed something, so the key is spent. */
  onEscape: () => boolean;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const targetEl = event.target as HTMLElement | null;
      // A field keeps its keys, and so does an open window (the share sheet): Delete pressed in
      // there must not reach the item selected behind it.
      if (targetEl?.closest("input, textarea, [contenteditable='true'], dialog")) return;
      if (event.key === "Escape" && onEscape()) {
        event.preventDefault();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
        return;
      }
      if (!selected) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        dispatch({ type: "remove", id: selected.id });
        return;
      }
      // Alt/Cmd/Ctrl with an arrow belongs to the browser (history, tabs), not to the board.
      const nudge =
        event.altKey || event.metaKey || event.ctrlKey
          ? null
          : nudgeDelta(event.key, event.shiftKey);
      if (nudge) {
        event.preventDefault();
        // One undo step per press: a held key repeats into the same step, the way a drag does.
        if (!event.repeat) dispatch({ type: "checkpoint" });
        dispatch({
          type: "patch",
          id: selected.id,
          patch: applyMove(selected, nudge.dx, nudge.dy),
          transient: true,
        });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, onEscape, selected]);
}
