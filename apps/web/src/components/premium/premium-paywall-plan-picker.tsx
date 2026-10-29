"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { featuredPlanId, monthlyEquivalentMinor, savingsPercent } from "@/lib/paywall-plans";
import { includesSubscriptionTrial } from "@/lib/subscription-trial";
import type { PremiumPaywallState } from "./use-premium-paywall";

const EASE_SMOOTH_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const planGridVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const planCardVariants: Variants = {
  hidden: { opacity: 0, y: 4 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: EASE_SMOOTH_OUT },
  },
};

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
  const { loading, pendingCheckout, plans, selected, view, offers, selectPlan } = purchase;
  const featuredId = featuredPlanId(plans);

  if (loading || pendingCheckout || plans.length === 0) return null;

  return (
    <motion.div
      // One plan must not sit in a half-width column (the catalog is monthly-only today).
      className={`grid gap-3 ${plans.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
      variants={reduceMotion ? undefined : planGridVariants}
      initial={reduceMotion ? false : "hidden"}
      animate="show"
    >
      {plans.map((plan) => {
        const selectedPlan = plan.id === selected?.id;
        const cardOffer = offers?.offers[plan.id];
        const planOffer =
          cardOffer && cardOffer.discountMinor > 0 ? cardOffer : undefined;
        const isFeatured = plan.id === featuredId;
        // List prices: a coupon shows its own strike-through, the badge speaks for the plan itself.
        const savings = isFeatured ? savingsPercent(plan, plans) : undefined;
        const chargedMinor = planOffer?.chargedPriceMinor ?? plan.priceMinor;
        const planHasTrial = includesSubscriptionTrial(plan, view?.trialEligibility);
        // Every card speaks per month; a longer plan adds the total it is actually charged.
        const perMonth = (minor: number) =>
          formatPrice(monthlyEquivalentMinor(minor, plan.periodMonths), locale);
        return (
          <motion.button
            key={plan.id}
            type="button"
            variants={reduceMotion ? undefined : planCardVariants}
            onClick={() => selectPlan(plan.id)}
            aria-pressed={selectedPlan}
            className="relative flex min-h-[96px] flex-col justify-between rounded-[var(--paywall-plan-radius)] px-3 py-3 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none motion-reduce:active:scale-100"
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
                transition={{ duration: 0.22, delay: 0.08, ease: EASE_SMOOTH_OUT }}
              >
                {savings ? t("badge_savings", { percent: savings }) : t("badge_value")}
              </motion.span>
            ) : null}
            <div className="flex items-center justify-between gap-1.5">
              <p
                className="text-xs font-semibold"
                style={{ color: "var(--color-secondary)" }}
              >
                {plan.name}
              </p>
            </div>
            <div>
              {planOffer ? (
                <p className="mt-1 text-xs font-semibold leading-tight">
                  <span className="sr-only">{t("price_before")}: </span>
                  <s
                    className="tabular-nums"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {perMonth(planOffer.listPriceMinor)}
                  </s>
                </p>
              ) : null}
              <p
                className={`text-xl font-bold tabular-nums leading-tight ${planOffer ? "mt-0.5" : "mt-1.5"}`}
                style={{
                  color: "var(--color-main)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {perMonth(chargedMinor)}
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {t("per_month")}
                </span>
              </p>
              {plan.periodMonths > 1 ? (
                <p
                  className="mt-0.5 text-xs font-semibold tabular-nums"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {t("total_for_months", {
                    months: plan.periodMonths,
                    price: formatPrice(chargedMinor, locale),
                  })}
                </p>
              ) : null}
              {planHasTrial ? (
                <p
                  className="mt-0.5 text-[11px] font-bold"
                  style={{ color: "var(--color-success)" }}
                >
                  {t("plan_trial_tag", { days: plan.trialDays })}
                </p>
              ) : null}
              {planOffer?.promotion ? (
                <p
                  className="mt-1 text-xs font-semibold"
                  style={{ color: "var(--color-success)" }}
                >
                  {planOffer.promotion.label}
                </p>
              ) : null}
            </div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
