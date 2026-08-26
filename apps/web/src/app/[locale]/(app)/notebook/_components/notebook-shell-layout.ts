"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { NotebookPageDoc } from "@mentor/types";

/**
 * How big the notebook is allowed to be, and what a "view" of it means.
 *
 * Split out of the shell because none of it touches the shell's state: these are the sizing rules
 * and the two vocabulary types the whole screen is written in. Keeping them beside a 1,600-line
 * component only made them harder to find.
 */

/**
 * A spread shows two facing pages, `left` and `left + 1` — a real notebook has no odd page on its
 * own. Turning moves by two, and turning back past page 0 closes the book: a spread you cannot
 * turn out of would read as broken, and "no visible response" is the worst answer to a swipe.
 */
export type View = { kind: "cover" } | { kind: "spread"; left: number };
export type Side = "left" | "right";

/** Matches the server's blank page, so an unsaved page and a fetched empty one render alike. */
export const EMPTY_PAGE: NotebookPageDoc = {
  version: 1,
  paper: "ruled",
  items: [],
  ink: [],
};

/** Long enough that a drag settles first, short enough that a closed tab loses nothing. */
export const AUTOSAVE_DELAY_MS = 900;

export const NOTEBOOK_MAX_WIDTH_PX = 1680;
export const COVER_MAX_WIDTH_PX = 760;
/**
 * Overlay chrome above the book. Product z-index scale (impeccable): overlay < rail < ink < panel.
 * Pagination / due / undo-save sit on the page; the rail and panel float over it.
 */
export const NOTEBOOK_Z = {
  overlay: 20,
  rail: 30,
  ink: 35,
  panel: 40,
} as const;

/** Same stadium radius as the ink tray (`rounded-[50px]`). */
export const NOTEBOOK_TRAY_RADIUS_CLASS = "rounded-[50px]";
/** A single leaf, shown below `MOBILE_QUERY` instead of a two-page spread — the cover's own page
 *  ratio (one page, no gutter), just a tighter pixel ceiling for a phone-sized screen. */
export const MOBILE_LEAF_MAX_WIDTH_PX = 480;
/** Tailwind's own `sm` breakpoint — below it a spread has no room to show two pages side by side. */
export const MOBILE_QUERY = "(max-width: 639px)";

/*
 * Six rounds of guessing how big the notebook can be without forcing the page to scroll, each one
 * wrong in a new way: four were a viewport-height *budget* (`calc(Ndvh * ratio)`) for the wrapper's
 * `maxWidth` — approximating how much of the screen the toolbar row, pagination row, rail and
 * padding leave behind (88%/92%, then 84%/90%, then mobile's own 80%dvh missing the rail row
 * entirely once it moved from beside the spread to above it, then 70%dvh still short). The fifth
 * tried making the wrapper itself a flex item and setting BOTH its width and height from
 * `aspectRatio` with both dimensions `auto` — worse: tested in isolation, that collapses an empty
 * box to 0×0 (a box with no content has no `auto` size to derive a ratio from), which is exactly
 * why the whole notebook went blank rather than just overflowing.
 *
 * The sixth keeps what was actually right about the very first approach — CSS `aspect-ratio`
 * deriving a HEIGHT from a WIDTH that's already definite never has this collapse-to-0 problem,
 * because only one dimension is ever `auto` — and fixes the one thing that was ever really wrong
 * with it: the WIDTH was a guessed `dvh` number instead of a measured one. `useFitSize` below
 * measures the OUTER box (a flex item, `flex: 1 1 0%`, that gets its real, definite size from the
 * toolbar row and pagination row around it, computed by the browser's own layout) with a
 * `ResizeObserver`, synchronously on first layout too (`useLayoutEffect` + an immediate
 * `getBoundingClientRect()`, so there's no blank first frame while waiting for the observer's first
 * callback). `fitWithin` then does the arithmetic `calc(Ndvh * ratio)` was trying to approximate —
 * the width that keeps the ratio's height inside the outer box — from the real measured height, not
 * a guess. The result only ever feeds `maxWidth` (never `width`/`height` directly), with a safe,
 * always-nonzero pixel-ceiling fallback for the one frame before any measurement exists.
 */
export function useFitSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setBox({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, box] as const;
}

/** The width that keeps a box of `ratio` (width/height) inside `outer`, capped at `maxWidthPx`. */
export function fitWithin(
  outer: { width: number; height: number },
  ratio: number,
  maxWidthPx: number,
): { width: number; height: number } {
  const byHeight = { width: outer.height * ratio, height: outer.height };
  const fit =
    byHeight.width <= outer.width
      ? byHeight
      : { width: outer.width, height: outer.width / ratio };
  const width = Math.min(fit.width, maxWidthPx);
  return { width, height: width / ratio };
}
