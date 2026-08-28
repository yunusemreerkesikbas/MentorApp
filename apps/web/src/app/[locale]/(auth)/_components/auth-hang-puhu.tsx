"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

import {
  BLINK_DURATION_MS,
  DOUBLE_BLINK_GAP_MS,
  isDoubleBlink,
  nextBlinkDelay,
  nextIdleGaze,
} from "@/components/theme-lamp/lamp-choreography";

import {
  type AuthHangFocus,
  type HangGaze,
  type HangPose,
  HANG_BOB_DURATION_S,
  HANG_BOB_PX,
  HANG_DISPLAY_PX,
  HANG_GRIP_Y,
  HANG_POSE_FADE_MS,
  HANG_POSES,
  HANG_SPRITES,
  hangFocusFromTarget,
  hangPose,
  hangWingClipPaths,
  isPasswordRevealControl,
} from "./auth-hang-choreography";

const HANG_EASE = [0.25, 0.82, 0.32, 1] as const;
const WING_CLIPS = hangWingClipPaths();

export function useAuthHang(enabled: boolean) {
  const [focus, setFocus] = useState<AuthHangFocus>("idle");
  const reduceMotion = useReducedMotion() ?? false;
  const idle = enabled && focus === "idle";
  const { blinking, gaze } = useHangIdle(idle && !reduceMotion);
  const pose = hangPose(
    focus,
    idle ? blinking : false,
    idle ? gaze : "centre",
  );

  const onFocusCapture = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      if (!enabled) return;
      const next = hangFocusFromTarget(event.target);
      if (next) setFocus(next);
    },
    [enabled],
  );

  const onBlurCapture = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      if (!enabled) return;
      const leavingHang =
        hangFocusFromTarget(event.target) != null ||
        isPasswordRevealControl(event.target);
      if (!leavingHang) return;
      if (
        hangFocusFromTarget(event.relatedTarget) != null ||
        isPasswordRevealControl(event.relatedTarget)
      ) {
        return;
      }
      setFocus("idle");
    },
    [enabled],
  );

  return {
    back: enabled ? (
      <HangLayer
        pose={pose}
        focus={focus}
        layer="back"
        idle={idle}
        reduceMotion={reduceMotion}
      />
    ) : null,
    front: enabled ? (
      <HangLayer
        pose={pose}
        focus={focus}
        layer="front"
        idle={idle}
        reduceMotion={reduceMotion}
      />
    ) : null,
    onFocusCapture,
    onBlurCapture,
  };
}

function useHangIdle(active: boolean) {
  const [blinking, setBlinking] = useState(false);
  const [gaze, setGaze] = useState<HangGaze>("centre");
  const gazeTarget = useRef<HangGaze>("centre");

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const blink = (remaining: number) => {
      if (cancelled) return;
      setBlinking(true);
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
        if (document.visibilityState !== "visible") {
          schedule();
          return;
        }
        gazeTarget.current = nextIdleGaze(gazeTarget.current, Math.random());
        blink(isDoubleBlink(Math.random()) ? 1 : 0);
      }, nextBlinkDelay(Math.random()));
    };

    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active]);

  return { blinking, gaze };
}

function HangLayer({
  pose,
  focus,
  layer,
  idle,
  reduceMotion,
}: {
  pose: HangPose;
  focus: AuthHangFocus;
  layer: "back" | "front";
  idle: boolean;
  reduceMotion: boolean;
}) {
  const cover = pose === "cover";
  if (layer === "front" && cover) return null;

  const bob = idle && !reduceMotion;
  const poseFade = {
    duration: reduceMotion ? 0 : HANG_POSE_FADE_MS / 1000,
  };

  return (
    <motion.div
      className={`pointer-events-none absolute left-1/2 ${layer === "back" ? "z-0" : "z-[2]"}`}
      data-testid={layer === "back" ? "auth-hang-puhu" : "auth-hang-puhu-front"}
      data-pose={pose}
      data-focus={focus}
      data-layer={layer}
      style={{
        top: -HANG_DISPLAY_PX * HANG_GRIP_Y,
        width: HANG_DISPLAY_PX,
        height: HANG_DISPLAY_PX,
      }}
      aria-hidden
      initial={false}
      animate={
        bob
          ? { x: "-50%", y: [0, -HANG_BOB_PX, 0] }
          : { x: "-50%", y: 0 }
      }
      transition={
        bob
          ? {
              duration: HANG_BOB_DURATION_S,
              repeat: Infinity,
              ease: "easeInOut",
            }
          : { duration: reduceMotion ? 0 : 0.22, ease: HANG_EASE }
      }
    >
      {layer === "front" ? (
        <>
          <div
            className="absolute inset-0"
            style={{ clipPath: WING_CLIPS.left, WebkitClipPath: WING_CLIPS.left }}
          >
            <HangStack pose={pose} poseFade={poseFade} />
          </div>
          <div
            className="absolute inset-0"
            style={{ clipPath: WING_CLIPS.right, WebkitClipPath: WING_CLIPS.right }}
          >
            <HangStack pose={pose} poseFade={poseFade} />
          </div>
        </>
      ) : (
        <HangStack pose={pose} poseFade={poseFade} />
      )}
    </motion.div>
  );
}

function HangStack({
  pose,
  poseFade,
}: {
  pose: HangPose;
  poseFade: { duration: number };
}) {
  return (
    <>
      {HANG_POSES.map((candidate) => (
        <motion.span
          key={candidate}
          className="absolute inset-0"
          initial={false}
          animate={{ opacity: candidate === pose ? 1 : 0 }}
          transition={poseFade}
        >
          <Image
            src={HANG_SPRITES[candidate]}
            alt=""
            width={HANG_DISPLAY_PX}
            height={HANG_DISPLAY_PX}
            className="absolute inset-0 size-full object-contain"
            priority={candidate === "rest"}
          />
        </motion.span>
      ))}
    </>
  );
}
