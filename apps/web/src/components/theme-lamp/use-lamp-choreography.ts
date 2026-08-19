"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

import type { Theme } from "@/lib/theme";
import {
  BLINK_DURATION_MS,
  DOUBLE_BLINK_GAP_MS,
  type LampInteraction,
  type LeanOffset,
  type PullReaction,
  computeLean,
  isDoubleBlink,
  nextBlinkDelay,
  pullReaction,
} from "./lamp-choreography";

const CENTRED: LeanOffset = { x: 0, y: 0 };
/** Long enough to read the squint, short enough that the wing is already on its way back. */
const REACTION_MS = 220;

/**
 * Drives the owl: idle blinking, the lean toward the pointer, the reach, and the beat right after
 * the cord is pulled. Every listener is bound through the returned React props, so nothing is
 * attached to `window` and nothing runs once the pointer leaves.
 */
export function useLampChoreography() {
  const reduceMotion = useReducedMotion() ?? false;
  const [interaction, setInteraction] = useState<LampInteraction>("idle");
  const [pointerLean, setPointerLean] = useState<LeanOffset>(CENTRED);
  const [blinking, setBlinking] = useState(false);
  const [reaction, setReaction] = useState<PullReaction | null>(null);
  /** Read once on enter — sampling it per pointermove would be a layout read every frame. */
  const centreRef = useRef<{ x: number; y: number } | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (reduceMotion) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const blink = (remaining: number) => {
      if (cancelled) return;
      setBlinking(true);
      timer = setTimeout(() => {
        if (cancelled) return;
        setBlinking(false);
        timer = setTimeout(
          () => (remaining > 0 ? blink(remaining - 1) : schedule()),
          remaining > 0 ? DOUBLE_BLINK_GAP_MS : 0,
        );
      }, BLINK_DURATION_MS);
    };

    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(() => {
        if (cancelled) return;
        // A hidden tab gets no blinks: re-arm instead, so nothing animates off-screen.
        if (document.visibilityState !== "visible") {
          schedule();
          return;
        }
        blink(isDoubleBlink(Math.random()) ? 1 : 0);
      }, nextBlinkDelay(Math.random()));
    };

    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reduceMotion]);

  useEffect(() => () => clearTimeout(reactionTimer.current), []);

  const handlePointerEnter = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    centreRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setInteraction((current) => (current === "idle" ? "near" : current));
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (reduceMotion || !centreRef.current) return;
      setPointerLean(computeLean({ x: event.clientX, y: event.clientY }, centreRef.current));
    },
    [reduceMotion],
  );

  const handlePointerLeave = useCallback(() => {
    centreRef.current = null;
    setPointerLean(CENTRED);
    setInteraction("idle");
  }, []);

  const reach = useCallback(() => setInteraction("hover"), []);

  const release = useCallback(() => {
    setInteraction(centreRef.current ? "near" : "idle");
  }, []);

  /** Called straight after the theme has already flipped — the beat never gates the result. */
  const playPull = useCallback(
    (nextTheme: Theme) => {
      setInteraction("pulling");
      if (reduceMotion) {
        setInteraction(centreRef.current ? "hover" : "idle");
        return;
      }
      setReaction(pullReaction(nextTheme));
      clearTimeout(reactionTimer.current);
      reactionTimer.current = setTimeout(() => {
        setReaction(null);
        setInteraction(centreRef.current ? "hover" : "idle");
      }, REACTION_MS);
    },
    [reduceMotion],
  );

  return {
    interaction,
    pointerLean,
    blinking,
    reaction,
    reduceMotion,
    playPull,
    sceneHandlers: {
      onPointerEnter: handlePointerEnter,
      onPointerMove: handlePointerMove,
      onPointerLeave: handlePointerLeave,
    },
    buttonHandlers: {
      onPointerEnter: reach,
      onPointerLeave: release,
      onFocus: reach,
      onBlur: release,
    },
  };
}
