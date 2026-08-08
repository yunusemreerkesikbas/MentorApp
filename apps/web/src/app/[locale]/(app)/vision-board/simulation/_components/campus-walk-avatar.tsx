"use client";

import { motion } from "framer-motion";

import type { CampusWalkPhase } from "./campus-walk-state";

export function CampusWalkAvatar({
  phase,
  reducedMotion,
}: {
  phase: CampusWalkPhase;
  reducedMotion: boolean;
}) {
  const walking = phase === "WALKING" && !reducedMotion;
  const arriving = phase === "ARRIVING" && !reducedMotion;

  return (
    <motion.div
      className="pointer-events-none absolute bottom-5 left-1/2 z-20 h-36 w-24 -translate-x-1/2 drop-shadow-[0_10px_12px_rgba(17,24,39,0.28)] sm:h-44 sm:w-28"
      animate={
        walking
          ? { y: [0, -5, 0] }
          : arriving
            ? { y: [12, -4, 0], scale: [0.94, 1.03, 1] }
            : { y: 0, scale: 1 }
      }
      transition={
        walking
          ? { duration: 0.48, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
          : { duration: 0.5, ease: "easeOut" }
      }
      aria-hidden="true"
      data-testid="campus-walk-avatar"
    >
      <svg viewBox="0 0 112 176" className="h-full w-full" role="presentation">
        <defs>
          <linearGradient id="campus-avatar-jacket" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--color-main)" />
            <stop offset="1" stopColor="var(--color-accent)" />
          </linearGradient>
        </defs>

        <circle cx="56" cy="34" r="23" fill="#EFC29F" />
        <path d="M34 35c0-18 10-28 23-28 17 0 25 12 22 31-7-8-16-12-27-12-7 0-13 3-18 9Z" fill="#2B211F" />
        <path d="M43 51c4 5 9 7 13 7s10-2 14-7v18H43V51Z" fill="#EFC29F" />

        <motion.g
          style={{ transformOrigin: "36px 78px" }}
          animate={walking ? { rotate: [13, -13, 13] } : { rotate: arriving ? -20 : 5 }}
          transition={walking ? { duration: 0.72, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" } : { duration: 0.35 }}
        >
          <rect x="24" y="76" width="15" height="55" rx="7.5" fill="var(--color-main)" />
          <circle cx="31.5" cy="132" r="7" fill="#EFC29F" />
        </motion.g>
        <motion.g
          style={{ transformOrigin: "76px 78px" }}
          animate={walking ? { rotate: [-13, 13, -13] } : { rotate: arriving ? 26 : -5 }}
          transition={walking ? { duration: 0.72, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" } : { duration: 0.35 }}
        >
          <rect x="73" y="76" width="15" height="55" rx="7.5" fill="var(--color-main)" />
          <circle cx="80.5" cy="132" r="7" fill="#EFC29F" />
        </motion.g>

        <path d="M36 65h40c10 18 11 43 6 66H30c-5-23-4-48 6-66Z" fill="url(#campus-avatar-jacket)" />
        <rect x="42" y="68" width="28" height="42" rx="10" fill="var(--color-surface)" opacity="0.95" />
        <path d="M45 75h22v26H45z" fill="var(--color-surface-soft)" />
        <circle cx="56" cy="88" r="5" fill="var(--color-accent)" />

        <motion.g
          style={{ transformOrigin: "47px 128px" }}
          animate={walking ? { rotate: [-12, 12, -12] } : { rotate: 0 }}
          transition={walking ? { duration: 0.72, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" } : { duration: 0.25 }}
        >
          <rect x="37" y="124" width="18" height="42" rx="9" fill="#273449" />
          <path d="M35 160h24c3 0 5 3 5 7v3H36c-5 0-7-7-1-10Z" fill="#F5F1E8" />
        </motion.g>
        <motion.g
          style={{ transformOrigin: "65px 128px" }}
          animate={walking ? { rotate: [12, -12, 12] } : { rotate: 0 }}
          transition={walking ? { duration: 0.72, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" } : { duration: 0.25 }}
        >
          <rect x="57" y="124" width="18" height="42" rx="9" fill="#273449" />
          <path d="M56 160h24c6 3 4 10-1 10H51v-3c0-4 2-7 5-7Z" fill="#F5F1E8" />
        </motion.g>
      </svg>
    </motion.div>
  );
}

