"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { staggerItemVariants, staggerListVariants } from "@/lib/stagger-motion";
import type { PremiumPaywallState } from "./use-premium-paywall";

function formatPrice(minor: number, locale: string): string {
  return (minor / 100).toLocaleString(locale === "en" ? "en-GB" : "tr-TR", {
    style: "currency",
    currency: "TRY",
  });
}

export function PremiumPaywallPlanPicker({ purchase }: { purchase: PremiumPaywallState }) {
  const t = useTranslations("paywall");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const { loading, pendingCheckout, plans, selected, offers, selectPlan } = purchase;
  const featuredPeriod = Math.max(0, ...plans.map((plan) => plan.periodMonths));
  const showValueBadge = plans.length > 1 && featuredPeriod > 1;

  if (loading || pendingCheckout || plans.length === 0) return null;

  return (
    <motion.div
      // One plan must not sit in a half-width column (the catalog is monthly-only today).
      className={`mt-5 grid gap-3 lg:mt-4 ${plans.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
      variants={reduceMotion ? undefined : staggerListVariants}
      initial={reduceMotion ? false : "hidden"}
      animate="show"
    >
      {plans.map((plan) => {
        const selectedPlan = plan.id === selected?.id;
        const cardOffer = offers?.offers[plan.id];
        const planOffer =
          cardOffer && cardOffer.discountMinor > 0 ? cardOffer : undefined;
        const isFeatured =
          showValueBadge && plan.periodMonths === featuredPeriod;
        const periodLabel =
          plan.periodMonths === 1
            ? t("per_month")
            : t("per_months", { months: plan.periodMonths });
        return (
          <motion.button
            key={plan.id}
            type="button"
            variants={reduceMotion ? undefined : staggerItemVariants}
            onClick={() => selectPlan(plan.id)}
            aria-pressed={selectedPlan}
            className="relative min-h-11 rounded-[var(--paywall-plan-radius)] px-3 py-3 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none motion-reduce:active:scale-100"
            style={{
              backgroundColor: selectedPlan
                ? "var(--color-bg)"
                : "var(--color-surface-container)",
              border: "2px solid",
              borderColor: selectedPlan
                ? "var(--color-main)"
                : "transparent",
            }}
          >
            {isFeatured ? (
              <motion.span
                className="absolute -top-2 right-2 whitespace-nowrap rounded-[var(--radius-card)] px-2 py-0.5 text-xs font-semibold"
                style={{
                  backgroundColor: "var(--color-success)",
                  color: "var(--color-btn-label)",
                }}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.86 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, delay: 0.2, ease: "easeOut" }}
              >
                {t("badge_value")}
              </motion.span>
            ) : null}
            <p
              className="text-xs font-semibold"
              style={{ color: "var(--color-secondary)" }}
            >
              {plan.name}
            </p>
            {planOffer ? (
              <p className="mt-2 text-xs font-semibold leading-tight">
                <span className="sr-only">{t("price_before")}: </span>
                <s
                  className="tabular-nums"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {formatPrice(planOffer.listPriceMinor, locale)}
                </s>
              </p>
            ) : null}
            <p
              className={`text-xl font-bold tabular-nums leading-tight ${planOffer ? "mt-0.5" : "mt-2"}`}
              style={{
                color: "var(--color-main)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {formatPrice(planOffer?.chargedPriceMinor ?? plan.priceMinor, locale)}
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--color-secondary)" }}
              >
                {periodLabel}
              </span>
            </p>
            {planOffer?.promotion ? (
              <p
                className="mt-1 text-xs font-semibold"
                style={{ color: "var(--color-success)" }}
              >
                {planOffer.promotion.label}
              </p>
            ) : null}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
