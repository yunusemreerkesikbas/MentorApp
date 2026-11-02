"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { PUHU_MOTION_FRAMES } from "@/lib/onboarding-assets";
import { useIsPremium } from "@/lib/subscription-context";

const FREE_FRAMES = {
  rest: PUHU_MOTION_FRAMES.default,
  talkClosed: PUHU_MOTION_FRAMES.talkClosed,
  blink: PUHU_MOTION_FRAMES.blink,
  lookDown: PUHU_MOTION_FRAMES.lookDown,
};

// Masked Puhu speaks for premium (DESIGN.md §7). One shared crop box, so the stack never jitters.
const PREMIUM_ROOT = "/mascot/puhu/motion/premium";
const PREMIUM_FRAMES: Record<keyof typeof FREE_FRAMES, string> = {
  rest: `${PREMIUM_ROOT}/rest.png`,
  talkClosed: `${PREMIUM_ROOT}/talk-closed.png`,
  blink: `${PREMIUM_ROOT}/blink.png`,
  lookDown: `${PREMIUM_ROOT}/look-down.png`,
};

/** Keep every frame mounted so speaking never waits for a new image to decode. */
export function PuhuSpeakingMascot({
  isSpeaking,
  isLoading,
}: {
  isSpeaking: boolean;
  isLoading: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const frames = useIsPremium() ? PREMIUM_FRAMES : FREE_FRAMES;
  const [mouthClosed, setMouthClosed] = useState(false);
  const [blinking, setBlinking] = useState(false);
  const speaking = isSpeaking && !reduceMotion;

  useEffect(() => {
    if (!speaking) return;
    const timer = window.setInterval(() => setMouthClosed((closed) => !closed), 150);
    return () => window.clearInterval(timer);
  }, [speaking]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setBlinking(false));
    if (speaking || isLoading || reduceMotion) {
      return () => window.cancelAnimationFrame(frame);
    }
    let blinkTimer = 0;
    const timer = window.setInterval(() => {
      setBlinking(true);
      blinkTimer = window.setTimeout(() => setBlinking(false), 180);
    }, 4500);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
      window.clearTimeout(blinkTimer);
    };
  }, [speaking, isLoading, reduceMotion]);

  const currentFrame = isLoading
    ? frames.lookDown
    : speaking
      ? mouthClosed ? frames.talkClosed : frames.rest
      : blinking && !reduceMotion ? frames.blink : frames.rest;

  return (
    <motion.div
      className="relative size-full"
      animate={speaking ? { y: [0, -2, 0] } : { y: 0 }}
      transition={{ duration: 0.3, repeat: speaking ? Infinity : 0, ease: "easeInOut" }}
      aria-hidden="true"
    >
      {Object.values(frames).map((src) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          priority
          sizes="(max-width: 640px) 96px, 112px"
          className={`object-contain drop-shadow-md ${src === currentFrame ? "opacity-100" : "opacity-0"}`}
        />
      ))}
    </motion.div>
  );
}
