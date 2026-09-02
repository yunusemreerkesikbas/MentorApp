"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { PUHU_MOTION_FRAMES } from "@/lib/onboarding-assets";

const FRAME_DELAYS = [250, 220, 220, 160, 400, 380] as const;
const FRAMES = [
  PUHU_MOTION_FRAMES.gazeLeft,
  PUHU_MOTION_FRAMES.gazeRight,
  PUHU_MOTION_FRAMES.blink,
  PUHU_MOTION_FRAMES.default,
  PUHU_MOTION_FRAMES.wave,
] as const;

export function WelcomeIntroPuhu({
  completed,
  onComplete,
}: {
  completed: boolean;
  onComplete: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [frame, setFrame] = useState(reduceMotion ? FRAMES.length : 0);

  useEffect(() => {
    if (completed || reduceMotion) {
      onComplete();
      return;
    }
    if (frame >= FRAMES.length) {
      onComplete();
      return;
    }
    const timer = window.setTimeout(() => setFrame((value) => value + 1), FRAME_DELAYS[frame]);
    return () => window.clearTimeout(timer);
  }, [completed, frame, onComplete, reduceMotion]);

  const effectiveFrame = completed || reduceMotion ? FRAMES.length : frame;
  const fullReveal = effectiveFrame >= 3;
  const src = FRAMES[Math.min(effectiveFrame, FRAMES.length - 1)] ?? PUHU_MOTION_FRAMES.default;

  return (
    <motion.div
      className="relative size-56 sm:size-64"
      animate={effectiveFrame >= 4 && !reduceMotion ? { y: [0, -10, 0], rotate: [0, -2, 0] } : { y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      <motion.div
        className="absolute inset-0 overflow-hidden"
        initial={false}
        animate={{
          clipPath: fullReveal ? "circle(72% at 50% 50%)" : "circle(17% at 50% 39%)",
          opacity: 1,
        }}
        transition={{ duration: reduceMotion ? 0.12 : 0.42, ease: "easeOut" }}
      >
        <Image src={src} alt="" fill priority sizes="256px" className="object-contain" aria-hidden />
      </motion.div>
    </motion.div>
  );
}
