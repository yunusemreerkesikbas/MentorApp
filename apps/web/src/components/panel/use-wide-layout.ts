"use client";

import { useSyncExternalStore } from "react";

const WIDE_QUERY = "(min-width: 1280px)";
const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/**
 * Two columns from 1280px, one below (DESIGN.md §4). Chosen in JS rather than CSS `order` so every
 * card mounts once and the reading/focus order always matches what is on screen.
 */
export function useWideLayout(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}
