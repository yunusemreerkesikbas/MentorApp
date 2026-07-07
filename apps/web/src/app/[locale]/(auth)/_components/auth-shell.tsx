"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion, useReducedMotion } from "framer-motion";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left.mjs";
import type { ReactNode } from "react";
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
        className="flex min-h-[34rem] w-full max-w-[23.4375rem] flex-col rounded-[var(--radius-card)] border border-white bg-white/80 px-5 py-6"
        style={{ boxShadow: "var(--shadow-card)" }}
        {...cardMotion}
      >
        {showBackHome ? (
          <motion.header className="mb-4" {...headerMotion}>
            <Link
              href="/"
              aria-label={t("back_home")}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/5 transition-colors hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
              style={{ color: "var(--color-main)" }}
            >
              <ChevronLeft size={20} strokeWidth={2} aria-hidden />
            </Link>
          </motion.header>
        ) : null}
        <div className="flex flex-1 flex-col justify-center">{children}</div>
      </motion.div>
    </main>
  );
}
