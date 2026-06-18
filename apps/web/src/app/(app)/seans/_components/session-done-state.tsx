"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@mentor/ui";

export interface SessionDoneStateProps {
  focusElapsed: number;
  onReset: () => void;
}

export function SessionDoneState({ focusElapsed, onReset }: SessionDoneStateProps) {
  const reduceMotion = useReducedMotion();
  const phaseMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
        exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
      };

  return (
    <motion.div
      className="flex w-full flex-col items-center gap-6 text-center"
      {...phaseMotion}
    >
      <span
        className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-chip) 30%, transparent)",
          color: "var(--color-chip-text)",
          fontFamily: "var(--font-body)",
        }}
      >
        Seans kaydedildi
      </span>
      <p
        className="text-xl font-bold"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        Güzel iş çıkardın
      </p>
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {Math.floor(focusElapsed / 60)} dakika odaklandın.
      </p>
      <div className="flex w-full flex-col gap-3">
        <Button onClick={onReset} fullWidth>
          Yeni seans
        </Button>
        <Link
          href="/panel"
          className="flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-card)] text-sm font-semibold transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          Panele dön
        </Link>
      </div>
    </motion.div>
  );
}
