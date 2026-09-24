"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { CLOUD_ASSETS } from "@/lib/onboarding-assets";

/** The animation code is only needed after an onboarding handover starts. */
export function CloudTransitionOverlay({
  covering,
  onDone,
}: {
  covering: boolean;
  onDone: () => void;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const duration = reduceMotion ? 0.12 : 0.62;

  return (
    <div
      className="pointer-events-auto fixed inset-0 overflow-hidden"
      style={{ zIndex: "var(--z-route-transition)" }}
      aria-hidden
    >
      <motion.div
        className="absolute inset-0 bg-[var(--color-bg)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: covering ? 1 : 0 }}
        transition={{ duration: duration * 0.45, ease: "easeOut", delay: covering ? duration * 0.45 : 0 }}
      />
      <CloudLayer side="left" covering={covering} duration={duration} onDone={onDone} />
      <CloudLayer side="right" covering={covering} duration={duration} />
    </div>
  );
}

function CloudLayer({
  side,
  covering,
  duration,
  onDone,
}: {
  side: "left" | "right";
  covering: boolean;
  duration: number;
  onDone?: () => void;
}) {
  const parked = side === "left" ? "-104%" : "104%";
  const anchor = side === "left" ? "object-right-bottom" : "object-left-bottom";

  return (
    <motion.div
      className={`absolute inset-y-0 flex w-[92%] flex-col ${side === "left" ? "left-0" : "right-0"}`}
      initial={{ x: parked }}
      animate={{ x: covering ? "0%" : parked }}
      transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={onDone}
    >
      <div className="relative flex-1">
        <Image src={CLOUD_ASSETS[side]} alt="" fill priority sizes="92vw" className={`object-cover ${anchor}`} />
      </div>
      <div className="relative -mt-[15%] flex-1 scale-x-110 -scale-y-110">
        <Image src={CLOUD_ASSETS[side]} alt="" fill sizes="92vw" className={`object-cover ${anchor}`} />
      </div>
    </motion.div>
  );
}
