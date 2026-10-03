"use client";

import { useEffect, useState } from "react";
import { notebookOpening, useNotebookOpening } from "@/lib/notebook-opening";
import { forgetAllNotebookContents } from "@/lib/notebook-contents-cache";
import type { OpeningFlight } from "./notebook-opening-flight";

/**
 * The lift-and-open moment's place in the app shell, the one place both pages it joins share.
 *
 * Only this wrapper is on every page, and all it costs there is a store subscription. The flight
 * itself (the book, the desk's stylesheet and fonts) is its own chunk: the desk asks for it as soon
 * as it is on screen (`preloadNotebookOpeningFlight`), which is long before anything can be clicked,
 * and no other page ever starts a flight.
 *
 * Not `next/dynamic`: a lazy component suspends on its first render even when its chunk is already
 * here, and React holds a suspended reveal back for about 300 ms, which the click would feel as
 * lag. The loaded component is kept here instead, so a click mounts it in the same frame.
 */

type Flight = typeof OpeningFlight;

let loaded: Flight | null = null;
let request: Promise<Flight> | null = null;

function loadFlight(): Promise<Flight> {
  request ??= import("./notebook-opening-flight").then(
    (module) => (loaded = module.OpeningFlight),
    (error: unknown) => {
      // A failed fetch is not the answer for good: the next click asks again.
      request = null;
      throw error;
    },
  );
  return request;
}

/**
 * How long a click waits for the flight to take off. Past this its chunk is still on the way (a
 * click on a desk that has only just arrived, on a slow line), and the moment is not worth a dead
 * click: the student goes straight to the notebook, which then opens on its cover.
 */
const STALL_MS = 600;

/** Fetches the flight ahead of the click that needs it. Safe to call any number of times. */
export function preloadNotebookOpeningFlight(): void {
  loadFlight().catch(() => undefined);
}

export function NotebookOpeningOverlay() {
  const { run, start, underway, landing } = useNotebookOpening();
  // Only for the rare click that beats the chunk here: one render more once it arrives.
  const [, setArrivals] = useState(0);

  useEffect(() => {
    if (!start || loaded) return;
    let active = true;
    loadFlight()
      .then(() => {
        if (active) setArrivals((count) => count + 1);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [start]);

  // What the notebook keeps between pages belongs to the student signed in now. This wrapper
  // leaves with the signed-in shell (sign-out, a lost session), so that is where it all goes:
  // nothing stays in the air, and no contents summary is served to whoever signs in next.
  useEffect(
    () => () => {
      notebookOpening.reset();
      forgetAllNotebookContents();
    },
    [],
  );

  useEffect(() => {
    if (!start || underway) return;
    const timer = window.setTimeout(() => {
      const now = notebookOpening.get();
      if (now.run !== run || now.underway) return;
      notebookOpening.finish(run);
      start.navigate();
    }, STALL_MS);
    return () => window.clearTimeout(timer);
  }, [run, start, underway]);

  const Flight = loaded;
  if (!start || !Flight) return null;
  return <Flight key={run} run={run} start={start} landing={landing} />;
}
