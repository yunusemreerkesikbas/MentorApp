"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  advanceWeeklyRecapPlayback,
  createWeeklyRecapPlayback,
  navigateWeeklyRecapPlayback,
  replayWeeklyRecap,
  shouldWeeklyRecapAdvance,
  type WeeklyRecapPlaybackState,
  type WeeklyRecapSlide,
} from "@/lib/weekly-recap";

const FRAME_COMMIT_MS = 50;

export interface UseWeeklyRecapPlaybackResult {
  state: WeeklyRecapPlaybackState;
  progress: number;
  pageVisible: boolean;
  held: boolean;
  goBack: () => void;
  goForward: () => void;
  goTo: (index: number) => void;
  togglePlaying: () => void;
  setHeld: (held: boolean) => void;
}

export function useWeeklyRecapPlayback(
  slides: readonly WeeklyRecapSlide[],
  reducedMotion: boolean,
): UseWeeklyRecapPlaybackResult {
  const [state, setState] = useState<WeeklyRecapPlaybackState>(() =>
    createWeeklyRecapPlayback(reducedMotion),
  );
  const [pageVisible, setPageVisible] = useState(true);
  const [held, setHeld] = useState(false);
  const lastFrameRef = useRef<number | null>(null);
  const pendingMsRef = useRef(0);

  useEffect(() => {
    const onVisibilityChange = () => {
      setPageVisible(document.visibilityState === "visible");
      lastFrameRef.current = null;
      pendingMsRef.current = 0;
    };
    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (
      !shouldWeeklyRecapAdvance({
        playing: state.playing,
        pageVisible,
        held,
      })
    ) {
      lastFrameRef.current = null;
      pendingMsRef.current = 0;
      return;
    }

    let frameId = 0;
    const tick = (time: number) => {
      const previous = lastFrameRef.current;
      lastFrameRef.current = time;
      if (previous !== null) {
        pendingMsRef.current += Math.min(time - previous, 250);
        if (pendingMsRef.current >= FRAME_COMMIT_MS) {
          const deltaMs = pendingMsRef.current;
          pendingMsRef.current = 0;
          setState((current) =>
            advanceWeeklyRecapPlayback(current, deltaMs, slides),
          );
        }
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [held, pageVisible, slides, state.playing]);

  const goTo = useCallback(
    (index: number) => {
      setState((current) =>
        navigateWeeklyRecapPlayback(current, index, slides),
      );
    },
    [slides],
  );

  const goBack = useCallback(() => {
    setState((current) =>
      navigateWeeklyRecapPlayback(current, current.index - 1, slides),
    );
  }, [slides]);

  const goForward = useCallback(() => {
    setState((current) =>
      navigateWeeklyRecapPlayback(current, current.index + 1, slides),
    );
  }, [slides]);

  const togglePlaying = useCallback(() => {
    setState((current) => {
      if (current.completed) return replayWeeklyRecap();
      return { ...current, playing: !current.playing };
    });
  }, []);

  const progress = useMemo(() => {
    const slide = slides[state.index];
    if (!slide) return 0;
    return Math.min(state.elapsedMs / slide.durationMs, 1);
  }, [slides, state.elapsedMs, state.index]);

  return {
    state,
    progress,
    pageVisible,
    held,
    goBack,
    goForward,
    goTo,
    togglePlaying,
    setHeld,
  };
}
