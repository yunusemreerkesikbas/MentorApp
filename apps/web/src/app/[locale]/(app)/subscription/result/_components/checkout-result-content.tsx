"use client";

import { Check } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

const ConfettiBurst = dynamic(
  () =>
    import("@/components/confetti-burst").then((module) => ({
      default: module.ConfettiBurst,
    })),
  { ssr: false },
);

const CONFETTI_FALLBACK_MS = 6_500;

/** Checkout return overlay — fake/iyzico redirect target stays `/abonelik/sonuc`. */
export function CheckoutResultContent() {
  const reduceMotion = Boolean(useReducedMotion());
  const router = useRouter();
  const t = useTranslations("checkout");
  const ok = useSearchParams().get("status") === "success";
  const [confetti, setConfetti] = useState(ok && !reduceMotion);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const finishConfetti = useCallback(() => {
    setConfetti(false);
  }, []);

  useEffect(() => {
    if (!confetti) return;
    const fallback = window.setTimeout(finishConfetti, CONFETTI_FALLBACK_MS);
    return () => window.clearTimeout(fallback);
  }, [confetti, finishConfetti]);

  const closeHref = ok ? "/dashboard" : "/subscription";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      router.push(closeHref);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeHref, router]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-result-title"
      data-testid="checkout-result"
      className={`fixed inset-0 z-[90] flex flex-col overflow-hidden bg-[var(--color-bg)] ${ok ? "checkout-result-success" : ""}`}
    >
      {confetti ? (
        <div className="pointer-events-none absolute inset-0 z-[2]">
          <ConfettiBurst onComplete={finishConfetti} />
        </div>
      ) : null}

      <div className="relative z-[3] mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
        <motion.div
          className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-[18vh] pt-[max(12px,env(safe-area-inset-top))] text-center"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0.15 : 0.35, ease: "easeOut" }}
        >
          {ok ? (
            reduceMotion ? (
              <span
                className="grid size-24 place-items-center rounded-full"
                style={{ backgroundColor: "var(--color-success)" }}
              >
                <Check
                  className="size-12"
                  strokeWidth={2.4}
                  style={{ color: "var(--color-btn-label)" }}
                  aria-hidden
                />
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- animated SVG success mark
              <img
                src="/animation/success.svg?once=1"
                alt=""
                className="size-32"
              />
            )
          ) : null}

          <h1
            id="checkout-result-title"
            className="mt-6 text-3xl font-bold tracking-tight"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {ok ? t("title_success") : t("title_error")}
          </h1>
          <p
            className="mt-3 max-w-sm text-base leading-relaxed"
            style={{ color: "var(--color-secondary)" }}
          >
            {ok ? t("desc_success") : t("desc_error")}
          </p>

          {ok ? (
            <Link
              href="/dashboard"
              className="mt-8 inline-flex min-h-11 items-center justify-center text-sm font-semibold text-[var(--color-main)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {t("back_panel")}
            </Link>
          ) : (
            <Link
              href="/subscription"
              className="mt-8 flex min-h-11 w-full items-center justify-center rounded-[var(--radius-card)] px-6 py-3 text-base font-bold text-[var(--color-btn-label)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
              style={{
                backgroundColor: "var(--color-btn)",
                boxShadow: "var(--shadow-card)",
                fontFamily: "var(--font-body)",
              }}
            >
              {t("back_subscription")}
            </Link>
          )}
        </motion.div>
      </div>
    </div>
  );
}
