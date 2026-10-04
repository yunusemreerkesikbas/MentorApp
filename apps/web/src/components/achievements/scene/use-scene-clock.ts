"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * One requestAnimationFrame loop for the whole scene. `frame` paints for `now` and answers whether
 * anything is still moving; the loop stops when nothing is (the student reading costs no frames),
 * and the returned `kick` starts it again. A paused tab simply resumes at the right pose: every
 * frame is a function of time, not of the frame before it.
 */
export function useSceneClock(frame: (now: number) => boolean): () => void {
  const frameRef = useRef(frame);
  const kickRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    let request: number | null = null;
    const tick = (now: number) => {
      request = null;
      if (frameRef.current(now)) request = window.requestAnimationFrame(tick);
    };
    kickRef.current = () => {
      if (request === null) request = window.requestAnimationFrame(tick);
    };
    kickRef.current();
    return () => {
      if (request !== null) window.cancelAnimationFrame(request);
      kickRef.current = () => undefined;
    };
  }, []);

  return useCallback(() => kickRef.current(), []);
}
