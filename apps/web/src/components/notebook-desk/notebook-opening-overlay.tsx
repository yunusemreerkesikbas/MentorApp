"use client";

import dynamic from "next/dynamic";
import { useNotebookOpening } from "@/lib/notebook-opening";

/**
 * The lift-and-open moment's place in the app shell, the one place both pages it joins share.
 *
 * Only this wrapper is on every page, and all it costs there is a store subscription. The flight
 * itself (the book, the desk's stylesheet and fonts) is its own chunk: the desk asks for it as soon
 * as it is on screen (`preloadNotebookOpeningFlight`), which is long before anything can be clicked,
 * and no other page ever starts a flight.
 */
const OpeningFlight = dynamic(
  () => import("./notebook-opening-flight").then((module) => module.OpeningFlight),
  { ssr: false },
);

/** Fetches the flight ahead of the click that needs it. Safe to call any number of times. */
export function preloadNotebookOpeningFlight(): void {
  void import("./notebook-opening-flight");
}

export function NotebookOpeningOverlay() {
  const state = useNotebookOpening();
  if (!state.start) return null;
  return (
    <OpeningFlight
      key={state.run}
      run={state.run}
      start={state.start}
      landing={state.landing}
    />
  );
}
