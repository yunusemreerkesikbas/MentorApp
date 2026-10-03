"use client";

import { useSyncExternalStore } from "react";
import type { NotebookCoverStyle, NotebookKind } from "@mentor/types";
import type { DeskRect } from "./notebook-desk";

/**
 * The hand-off between the desk and the editor while a notebook is being lifted and opened.
 *
 * The moment spans a route change: the book leaves the desk on `/defterlerim`, the editor mounts on
 * `/defterlerim/[id]` underneath it while it is still in the air, and the book only lets go once
 * the editor's first spread is laid out where the book is about to land. Neither page outlives
 * that, so the moment lives here, in a module-level store, and the overlay that draws it lives in
 * the app shell, which both pages share.
 *
 * In memory only. A reload or a new tab has no book in the air; the editor then simply opens on
 * its cover as it always has.
 */

export interface NotebookOpeningBook {
  /** The notebook's id, or `"mistake"` for the system notebook, which the editor knows by route. */
  key: string;
  kind: NotebookKind;
  title: string;
  cover: NotebookCoverStyle;
  pageCount: number;
  dueCount: number;
  subject: { key: string; name: string } | null;
  meta: string;
  dueLabel: string | null;
}

export interface NotebookOpeningPose {
  rotateX: number;
  rotateZ: number;
  /** The book was hovered when clicked, so it is already a little off the desk. */
  lifted: boolean;
}

export interface NotebookOpeningStart {
  book: NotebookOpeningBook;
  /** The desk book's layout box on screen, before its 3D pose. */
  from: DeskRect;
  /** The part of the screen the editor will lay the book out in (the page area, chrome excluded). */
  area: DeskRect;
  pose: NotebookOpeningPose;
  /** Performs the navigation; the overlay calls it while the book is in the air. */
  navigate: () => void;
}

/** Where the editor's first spread came to rest: the whole spread, or one page on a phone. */
export interface NotebookOpeningLanding {
  rect: DeskRect;
  single: boolean;
}

export interface NotebookOpeningState {
  /** Bumps on every new opening, so a stale ready signal cannot settle a newer book. */
  run: number;
  start: NotebookOpeningStart | null;
  /**
   * The flight has taken over: its copy of the book is drawn over the desk's own (under reduced
   * motion, it has sent the student on). The flight is loaded on demand, so a click can come a
   * frame or so before it; until this is set the desk keeps its book where it was, or the book
   * would blink out before its copy appears.
   */
  underway: boolean;
  /** The editor's first spread on screen, once it is laid out. */
  landing: NotebookOpeningLanding | null;
}

const IDLE = { start: null, underway: false, landing: null } as const;

let state: NotebookOpeningState = { run: 0, ...IDLE };
const listeners = new Set<() => void>();

function emit(next: NotebookOpeningState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const notebookOpening = {
  get(): NotebookOpeningState {
    return state;
  },

  begin(start: NotebookOpeningStart): number {
    const run = state.run + 1;
    emit({ run, start, underway: false, landing: null });
    return run;
  },

  /** The flight is on screen and has the moment: the desk can let go of its book. */
  underway(run: number): void {
    if (run !== state.run || !state.start || state.underway) return;
    emit({ ...state, underway: true });
  },

  /**
   * Whether this notebook is in the air right now. A pure read, safe in a state initialiser: true
   * means the editor starts on the contents spread (the cover already opened in the air) and
   * reports where that spread lands.
   */
  isOpening(key: string): boolean {
    return state.start?.book.key === key && state.landing === null;
  },

  /** The editor's spread is on screen: the book can settle onto it and let go. */
  land(key: string, landing: NotebookOpeningLanding): void {
    if (!state.start || state.start.book.key !== key || state.landing) return;
    emit({ ...state, landing });
  },

  /** The overlay is gone. Leaves `run` so the next opening is still a new one. */
  finish(run: number): void {
    if (run !== state.run) return;
    emit({ run: state.run, ...IDLE });
  },
};

const SERVER_STATE: NotebookOpeningState = { run: 0, ...IDLE };

export function useNotebookOpening(): NotebookOpeningState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
}
