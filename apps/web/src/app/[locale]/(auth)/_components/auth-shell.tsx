"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { CircularBackLink } from "@/components/circular-back-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { isWelcomeSeen } from "@/lib/welcome-seen";

const subscribeWelcomeSeen = () => () => undefined;

/** Centered auth chrome — matches welcome + motion card entrance. */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations("auth.shell");
  const reduceMotion = useReducedMotion();
  const showBackHome = useSyncExternalStore(
    subscribeWelcomeSeen,
    () => !isWelcomeSeen(),
    () => false,
  );

  const headerMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: "easeOut" as const },
        },
      };

  const cardMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: "easeOut" as const, delay: 0.05 },
        },
      };

  return (
    <main className="mx-auto flex min-h-screen w-full items-center justify-center px-5 py-8">
      <motion.div
        className="flex min-h-[34rem] w-full max-w-[23.4375rem] flex-col rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_80%,transparent)] px-5 py-6"
        style={{ boxShadow: "var(--shadow-card)" }}
        {...cardMotion}
      >
        <motion.header
          className={`mb-4 flex items-center ${showBackHome ? "justify-between" : "justify-end"}`}
          {...headerMotion}
        >
          {showBackHome ? (
            <CircularBackLink
              href="/"
              label={t("back_home")}
              variant="soft"
            />
          ) : null}
          <ThemeToggle />
        </motion.header>
        <div className="flex flex-1 flex-col justify-center">{children}</div>
      </motion.div>
    </main>
  );
}
