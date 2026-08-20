"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

import type { Theme } from "@/lib/theme";
import {
  BLINK_DURATION_MS,
  DOUBLE_BLINK_GAP_MS,
  type LampInteraction,
  type LeanOffset,
  type OwlGaze,
  type PullReaction,
  computeLean,
  gazeFromLean,
  isDoubleBlink,
  nextBlinkDelay,
  nextIdleGaze,
  pullReaction,
} from "./lamp-choreography";

const CENTRED: LeanOffset = { x: 0, y: 0, tilt: 0 };
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
  const [gaze, setGaze] = useState<OwlGaze>("centre");
  const [reaction, setReaction] = useState<PullReaction | null>(null);
  /** Read once on enter — sampling it per pointermove would be a layout read every frame. */
  const centreRef = useRef<{ x: number; y: number } | null>(null);
  /** The painted scene, not the tracking dock — gaze is relative to Puhu, not the footer. */
  const sceneRef = useRef<HTMLButtonElement | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Where he *wants* to look. It only reaches the screen once a blink covers the change. */
  const gazeTarget = useRef<OwlGaze>("centre");
  const pointerNear = useRef(false);
  const blinkNow = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (reduceMotion) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const blink = (remaining: number) => {
      if (cancelled) return;
      setBlinking(true);
      // The eyes are shut for the whole crossfade, so this is where the pupils may jump without
      // anyone seeing them travel — the trick real animation uses to hide a saccade.
      setGaze(gazeTarget.current);
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
        // Glances ride the blink cadence instead of running their own timer — which is both
        // simpler and the only way they stay masked. The pointer owns his eyes while it is here.
        if (!pointerNear.current) {
          gazeTarget.current = nextIdleGaze(gazeTarget.current, Math.random());
        }
        blink(isDoubleBlink(Math.random()) ? 1 : 0);
      }, nextBlinkDelay(Math.random()));
    };

    blinkNow.current = () => {
      clearTimeout(timer);
      blink(0);
    };

    schedule();
    return () => {
      cancelled = true;
      blinkNow.current = null;
      clearTimeout(timer);
    };
  }, [reduceMotion]);

  /** Aims his eyes somewhere new, letting a blink carry the change rather than sliding pupils. */
  const lookAt = useCallback((next: OwlGaze) => {
    if (next === gazeTarget.current) return;
    gazeTarget.current = next;
    blinkNow.current?.();
  }, []);

  useEffect(() => () => clearTimeout(reactionTimer.current), []);

  const handlePointerEnter = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const box = sceneRef.current ?? event.currentTarget;
    const rect = box.getBoundingClientRect();
    centreRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    pointerNear.current = true;
    setInteraction((current) => (current === "idle" ? "near" : current));
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (reduceMotion || !centreRef.current) return;
      const lean = computeLean({ x: event.clientX, y: event.clientY }, centreRef.current);
      setPointerLean(lean);
      lookAt(gazeFromLean(lean, gazeTarget.current));
    },
    [lookAt, reduceMotion],
  );

  const handlePointerLeave = useCallback(() => {
    centreRef.current = null;
    pointerNear.current = false;
    setPointerLean(CENTRED);
    setInteraction("idle");
    lookAt("centre");
  }, [lookAt]);

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
    gaze,
    reaction,
    reduceMotion,
    playPull,
    sceneRef,
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
