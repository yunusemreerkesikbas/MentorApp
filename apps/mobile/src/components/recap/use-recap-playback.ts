import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  advanceWeeklyRecapPlayback,
  createWeeklyRecapPlayback,
  navigateWeeklyRecapPlayback,
  replayWeeklyRecap,
  shouldWeeklyRecapAdvance,
  type WeeklyRecapPlaybackState,
} from "@mentor/core";

/** Commit the clock every 50 ms, and never jump more than 250 ms after a stalled frame. */
const FRAME_COMMIT_MS = 50;
const FRAME_CAP_MS = 250;

export interface RecapPlayback {
  state: WeeklyRecapPlaybackState;
  /** The current slide's elapsed share, 0–1. */
  progress: number;
  pageVisible: boolean;
  held: boolean;
  goBack: () => void;
  goForward: () => void;
  goTo: (index: number) => void;
  togglePlaying: () => void;
  replay: () => void;
  setHeld: (held: boolean) => void;
}

/**
 * The story clock (the web's `useWeeklyRecapPlayback`): it runs on `requestAnimationFrame` while the
 * story plays, the app is in front and no finger holds the slide.
 */
export function useRecapPlayback(
  slides: readonly { durationMs: number }[],
  reducedMotion: boolean,
): RecapPlayback {
  const [state, setState] = useState<WeeklyRecapPlaybackState>(() =>
    createWeeklyRecapPlayback(reducedMotion),
  );
  const [pageVisible, setPageVisible] = useState(() => AppState.currentState !== "background");
  const [held, setHeld] = useState(false);
  const lastFrameRef = useRef<number | null>(null);
  const pendingMsRef = useRef(0);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      setPageVisible(next === "active");
      lastFrameRef.current = null;
      pendingMsRef.current = 0;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!shouldWeeklyRecapAdvance({ playing: state.playing, pageVisible, held })) {
      lastFrameRef.current = null;
      pendingMsRef.current = 0;
      return;
    }
    let frameId = 0;
    const tick = (time: number) => {
      const previous = lastFrameRef.current;
      lastFrameRef.current = time;
      if (previous !== null) {
        pendingMsRef.current += Math.min(time - previous, FRAME_CAP_MS);
        if (pendingMsRef.current >= FRAME_COMMIT_MS) {
          const deltaMs = pendingMsRef.current;
          pendingMsRef.current = 0;
          setState((current) => advanceWeeklyRecapPlayback(current, deltaMs, slides));
        }
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [held, pageVisible, slides, state.playing]);

  const goTo = useCallback(
    (index: number) => setState((current) => navigateWeeklyRecapPlayback(current, index, slides)),
    [slides],
  );
  const goBack = useCallback(
    () => setState((current) => navigateWeeklyRecapPlayback(current, current.index - 1, slides)),
    [slides],
  );
  const goForward = useCallback(
    () => setState((current) => navigateWeeklyRecapPlayback(current, current.index + 1, slides)),
    [slides],
  );
  const togglePlaying = useCallback(() => {
    setState((current) =>
      current.completed ? replayWeeklyRecap() : { ...current, playing: !current.playing },
    );
  }, []);
  const replay = useCallback(() => setState(replayWeeklyRecap()), []);

  const progress = useMemo(() => {
    const slide = slides[state.index];
    return slide ? Math.min(state.elapsedMs / slide.durationMs, 1) : 0;
  }, [slides, state.elapsedMs, state.index]);

  return { state, progress, pageVisible, held, goBack, goForward, goTo, togglePlaying, replay, setHeld };
}
