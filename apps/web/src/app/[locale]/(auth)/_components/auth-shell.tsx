"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { Card } from "@mentor/ui";

/** Centered auth chrome — matches landing header + motion card entrance. */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations("auth.shell");
  const reduceMotion = useReducedMotion();

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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
      <motion.header className="mb-6 text-center" {...headerMotion}>
        <Link
          href="/"
          className="text-3xl font-bold tracking-tight transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          Mentor
        </Link>
        <p className="mt-2 text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("tagline")}
        </p>
      </motion.header>
      <motion.div {...cardMotion}>
        <Card className="flex flex-col gap-4">{children}</Card>
      </motion.div>
      <p
        className="mt-6 text-center text-xs"
        style={{ color: "var(--color-secondary)" }}
      >
        <Link
          href="/"
          className="underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2"
        >
          {t("back_home")}
        </Link>
      </p>
    </main>
  );
}
