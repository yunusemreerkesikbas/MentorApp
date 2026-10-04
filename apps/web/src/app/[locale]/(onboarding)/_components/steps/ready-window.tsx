"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import type { CareerGroup } from "@mentor/types";
import { PUHU_MOTION_FRAMES, careerPuhu3d } from "@/lib/onboarding-assets";

/**
 * The lamp-lit window from the welcome's last scene ("senin yerin"), now holding the Puhu of the
 * field they picked. Multiply lets the tile's white ground take the lamp colour, so Puhu reads as
 * sitting in that warm light.
 */
export function ReadyWindow({ career }: { career: CareerGroup | null }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="relative size-44 shrink-0"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduceMotion ? 0.12 : 0.4, ease: "easeOut" }}
    >
      <div aria-hidden className="absolute -inset-12 rounded-full bg-[radial-gradient(circle,var(--play-window-glow),transparent_68%)]" />
      <div className="relative isolate size-full overflow-hidden rounded-[var(--play-radius)] border-[6px] border-[var(--play-window-frame)] bg-[radial-gradient(circle_at_50%_38%,var(--play-window-light),var(--play-window-lamp))] shadow-[var(--shadow-card-hover)]">
        <Image
          src={career ? careerPuhu3d(career) : PUHU_MOTION_FRAMES.default}
          alt=""
          fill
          priority
          sizes="176px"
          className="object-contain p-3 mix-blend-multiply"
        />
      </div>
    </motion.div>
  );
}
