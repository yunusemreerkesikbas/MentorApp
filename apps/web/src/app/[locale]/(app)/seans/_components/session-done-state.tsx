"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { Link } from "@/i18n/navigation";

export interface SessionDoneStateProps {
  focusElapsed: number;
  onReset: () => void;
}

export function SessionDoneState({
  focusElapsed,
  onReset,
}: SessionDoneStateProps) {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("session");
  const phaseMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.25, ease: "easeOut" as const },
        },
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
          backgroundColor:
            "color-mix(in srgb, var(--color-chip) 30%, transparent)",
          color: "var(--color-chip-text)",
          fontFamily: "var(--font-body)",
        }}
      >
        {t("done_chip")}
      </span>
      <p
        className="text-xl font-bold"
        style={{
          color: "var(--color-main)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {t("done_title")}
      </p>
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("done_elapsed", { minutes: Math.floor(focusElapsed / 60) })}
      </p>
      <div className="flex w-full flex-col gap-3">
        <Button onClick={onReset} fullWidth>
          {t("new_session")}
        </Button>
        <Link
          href="/panel"
          className="flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-card)] text-sm font-semibold transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {t("back_panel")}
        </Link>
      </div>
    </motion.div>
  );
}
