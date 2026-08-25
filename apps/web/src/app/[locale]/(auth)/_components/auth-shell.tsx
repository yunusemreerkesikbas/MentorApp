"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { CircularBackLink } from "@/components/circular-back-link";
import { usePathname } from "@/i18n/navigation";
import { authShellNav } from "@/lib/auth-paths";

const SHEET_EASE = [0.16, 1, 0.3, 1] as const;
const LG_QUERY = "(min-width: 64rem)";

function subscribeLg(onChange: () => void) {
  const mq = window.matchMedia(LG_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getLgSnapshot() {
  return window.matchMedia(LG_QUERY).matches;
}

/** Auth chrome — mobile bottom sheet, desktop centered card. */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations("auth.shell");
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const isDesktop = useSyncExternalStore(subscribeLg, getLgSnapshot, () => true);
  const nav = authShellNav(pathname);

  const panelMotion = reduceMotion
    ? {}
    : isDesktop
      ? {
          initial: { opacity: 0, y: 12 },
          animate: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.35, ease: "easeOut" as const, delay: 0.05 },
          },
        }
      : {
          initial: { y: "100%" },
          animate: {
            y: 0,
            transition: { duration: 0.32, ease: SHEET_EASE },
          },
        };

  const bodyMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.25, ease: "easeOut" as const, delay: 0.12 },
        },
      };

  return (
    <main className="flex min-h-dvh w-full flex-col justify-end overflow-hidden lg:items-center lg:justify-center lg:px-5 lg:py-8">
      <motion.div
        className="flex w-full max-h-[90dvh] flex-col overflow-hidden bg-[var(--color-surface)] max-lg:rounded-t-[16px] max-lg:shadow-[0px_-4px_10px_rgba(37,73,150,0.10)] lg:max-h-[82dvh] lg:max-w-[23.4375rem] lg:rounded-[var(--radius-card)] lg:border lg:border-[var(--color-border)] lg:shadow-[var(--shadow-card)]"
        {...panelMotion}
      >
        <div
          className="flex h-6 shrink-0 items-center justify-center lg:hidden"
          aria-hidden
        >
          <div
            className="h-1 w-9 rounded-full"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--color-secondary) 40%, transparent)",
            }}
          />
        </div>
        {nav.icon === "close" ? (
          <header className="flex shrink-0 items-center px-5 pb-2 lg:hidden">
            <CircularBackLink
              href={nav.href}
              label={t("close")}
              variant="soft"
              icon="close"
            />
          </header>
        ) : (
          <header className="flex shrink-0 items-center px-5 pb-2 lg:pt-5">
            <CircularBackLink
              href={nav.href}
              label={t("back_login")}
              variant="soft"
              icon="chevron"
            />
          </header>
        )}
        <motion.div
          className="mentor-scrollarea min-h-0 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2"
          {...bodyMotion}
        >
          <div>{children}</div>
        </motion.div>
      </motion.div>
    </main>
  );
}
