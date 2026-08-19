"use client";

import { motion } from "framer-motion";

import { CORD_PULL_MS, CORD_PULL_PX } from "./lamp-choreography";

/**
 * Both strings of the pendant: the suspension cord that carries the shade down from the footer
 * divider, and the knobbed pull cord the owl reaches for. Only the pull cord moves — it drops on
 * a click and springs back a touch past rest, the way a real string does.
 */
export function LampCord({
  width,
  height,
  shadeCentreX,
  shadeTopY,
  pullCordX,
  mouthY,
  pullCordLength,
  pulling,
  reduceMotion,
}: {
  width: number;
  height: number;
  shadeCentreX: number;
  shadeTopY: number;
  pullCordX: number;
  mouthY: number;
  pullCordLength: number;
  pulling: boolean;
  reduceMotion: boolean;
}) {
  const knobY = mouthY + pullCordLength;

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      <line
        x1={shadeCentreX}
        y1={0}
        x2={shadeCentreX}
        y2={shadeTopY}
        stroke="var(--lamp-cord)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <motion.g
        animate={{ y: pulling && !reduceMotion ? CORD_PULL_PX : 0 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : pulling
              ? { duration: CORD_PULL_MS / 1000, ease: "easeOut" }
              : { type: "spring", stiffness: 520, damping: 14, mass: 0.5 }
        }
      >
        <line
          x1={pullCordX}
          y1={mouthY - 2}
          x2={pullCordX}
          y2={knobY}
          stroke="var(--lamp-cord)"
          strokeWidth={1}
          strokeLinecap="round"
        />
        <circle cx={pullCordX} cy={knobY} r={2.4} fill="var(--lamp-shade-rim)" />
      </motion.g>
    </svg>
  );
}
