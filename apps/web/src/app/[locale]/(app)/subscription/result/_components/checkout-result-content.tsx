"use client";

import { useSearchParams } from "next/navigation";
import type { MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { Card, SectionHeading } from "@mentor/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { staggerItemVariants } from "@/lib/stagger-motion";
import {
  COACH_RETURN_TO_STORAGE_KEY,
  coachReturnHref,
} from "@/lib/community-coach-bridge";

/** Checkout return page — fake/iyzico redirect target. */
export function CheckoutResultContent() {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const translate = useTranslations("checkout");
  const ok = useSearchParams().get("status") === "success";

  function returnToCoach(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const stored = window.sessionStorage.getItem(COACH_RETURN_TO_STORAGE_KEY);
    window.sessionStorage.removeItem(COACH_RETURN_TO_STORAGE_KEY);
    router.push(coachReturnHref(stored));
  }

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
          transition: { duration: 0.35, ease: "easeOut" as const, delay: 0.06 },
        },
      };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-12 lg:px-8 lg:py-16">
      <motion.header className="text-center sm:text-left" {...headerMotion}>
        <span
          className="inline-block rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold"
          style={{
            backgroundColor: ok
              ? "color-mix(in srgb, var(--color-chip) 30%, transparent)"
              : "color-mix(in srgb, var(--color-secondary) 15%, transparent)",
            color: ok ? "var(--color-chip-text)" : "var(--color-secondary)",
            fontFamily: "var(--font-body)",
          }}
        >
          {ok ? translate("chip_success") : translate("chip_error")}
        </span>
        <h1
          className="mt-4 text-2xl font-bold"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {ok ? translate("title_success") : translate("title_error")}
        </h1>
      </motion.header>

      <motion.div
        {...cardMotion}
        variants={reduceMotion ? undefined : staggerItemVariants}
      >
        <Card>
          <SectionHeading as="h2">
            {ok ? translate("card_success") : translate("card_error")}
          </SectionHeading>
          <p
            className="mt-3 text-sm leading-relaxed"
            style={{ color: "var(--color-secondary)" }}
          >
            {ok ? translate("desc_success") : translate("desc_error")}
          </p>
        </Card>
      </motion.div>

      <div className="flex flex-col gap-3">
        {ok ? (
          <>
            <Link
              href="/coach"
              onClick={returnToCoach}
              className="flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-card)] px-6 py-3 text-base font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
              style={{
                backgroundColor: "var(--color-btn)",
                boxShadow: "var(--shadow-card)",
                fontFamily: "var(--font-body)",
              }}
            >
              {translate("go_coach")}
            </Link>
            <Link
              href="/dashboard"
              className="flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-card)] text-sm font-semibold transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
              style={{
                color: "var(--color-main)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {translate("back_panel")}
            </Link>
          </>
        ) : (
          <Link
            href="/subscription"
            className="flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-card)] px-6 py-3 text-base font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{
              backgroundColor: "var(--color-btn)",
              boxShadow: "var(--shadow-card)",
              fontFamily: "var(--font-body)",
            }}
          >
            {translate("back_subscription")}
          </Link>
        )}
      </div>
    </main>
  );
}
