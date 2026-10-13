"use client";

import { useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { CheckIcon } from "@solar-icons/react/linear/check";
import { TagIcon } from "@solar-icons/react/linear/tag";
import { Button } from "@mentor/ui";
import { FormError } from "@/components/form";
import { LegalLink } from "@/components/legal-link";
import { getStoreLinks } from "@/lib/purchase-mode";
import { StoreButtons } from "./store-buttons";
import { PendingCheckout } from "./pending-checkout";
import type { PremiumPaywallState } from "./use-premium-paywall";

function formatPrice(minor: number, locale: string): string {
  return (minor / 100).toLocaleString(locale === "en" ? "en-GB" : "tr-TR", {
    style: "currency",
    currency: "TRY",
  });
}

export function PremiumPaywallFooter({ purchase }: { purchase: PremiumPaywallState }) {
  const t = useTranslations("paywall");
  const tSub = useTranslations("subscription");
  const tLegal = useTranslations("legal");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const {
    includesTrial, selected, selectedDiscount, appliedCode, clearCoupon, couponOpen,
    couponInput, setCouponInput, applyCoupon, couponBusy, couponError, setCouponOpen,
    pendingCheckout, view, pendingTrial, purchaseEnabled, consent, setConsent, mode,
    error, busy, checkout,
  } = purchase;

  const consentRef = useRef<HTMLInputElement>(null);
  const consentHintId = useId();
  // The CTA stays live; pressed without consent it points at the box instead of starting checkout.
  const [consentAsked, setConsentAsked] = useState(false);
  const consentMissing = consentAsked && !consent;

  function start() {
    if (!consent) {
      setConsentAsked(true);
      consentRef.current?.focus();
      return;
    }
    void checkout();
  }

  const trialDays = includesTrial ? selected?.trialDays ?? 0 : 0;
  /**
   * The pre-purchase disclosure (ön bilgilendirme formu) must state the ACTUAL total charged and,
   * when only the first period is discounted, the price of every renewal after it.
   */
  const consentText = selectedDiscount
    ? tSub(
        selectedDiscount.promotion && selectedDiscount.promotion.appliesToPeriods > 1
          ? trialDays > 0
            ? "trial_consent_discounted_periods"
            : "consent_discounted_periods"
          : trialDays > 0
            ? "trial_consent_discounted"
            : "consent_discounted",
        {
          trialDays,
          periods: selectedDiscount.promotion?.appliesToPeriods ?? 1,
          introPrice: formatPrice(selectedDiscount.chargedPriceMinor, locale),
          renewalPrice: formatPrice(selectedDiscount.renewalPriceMinor, locale),
        },
      )
    : trialDays > 0
      ? tSub("trial_consent_days", { days: trialDays })
      : tSub("paid_consent", { price: formatPrice(selected?.priceMinor ?? 0, locale) });

  const couponField = appliedCode ? (
    <div
      className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-card)] px-3 py-2 text-xs"
      style={{ backgroundColor: "var(--color-surface-container)" }}
    >
      <span
        className="flex items-center gap-2 font-semibold"
        style={{ color: "var(--color-main)" }}
      >
        <TagIcon size={16} strokeWidth={1.75} aria-hidden />
        {t("coupon_applied")}: {appliedCode}
      </span>
      <button
        type="button"
        onClick={() => void clearCoupon()}
        className="min-h-11 px-2 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: "var(--color-secondary)" }}
      >
        {t("coupon_clear")}
      </button>
    </div>
  ) : couponOpen ? (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          aria-label={t("coupon_label")}
          placeholder={t("coupon_placeholder")}
          value={couponInput}
          onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void applyCoupon();
            }
          }}
          maxLength={32}
          className="min-h-11 flex-1 rounded-[var(--radius-card)] border px-3 text-sm uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{
            backgroundColor: "var(--color-bg)",
            borderColor: "var(--color-border)",
            color: "var(--color-main)",
          }}
        />
        <Button
          variant="secondary"
          className="!min-h-11 !px-4 !py-2 !text-sm"
          busy={couponBusy}
          disabled={couponInput.trim().length === 0}
          onClick={() => void applyCoupon()}
        >
          {t("coupon_apply")}
        </Button>
      </div>
      <FormError message={couponError} />
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setCouponOpen(true)}
      className="flex min-h-11 items-center gap-2 self-start text-xs font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      style={{ color: "var(--color-secondary)" }}
    >
      <TagIcon size={16} strokeWidth={1.75} aria-hidden />
      {t("coupon_toggle")}
    </button>
  );

  const footer = pendingCheckout ? <PendingCheckout checkoutUrl={view?.pendingCheckoutUrl ?? view?.pendingTrialCheckoutUrl ?? null} isTrial={pendingTrial} /> : (
    <motion.div
      className="flex flex-col gap-2 lg:gap-3"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.2, ease: "easeOut" }}
    >
      {purchaseEnabled ? couponField : null}

      {purchaseEnabled ? (
        <label
          className="flex min-h-11 cursor-pointer items-start gap-3 text-xs leading-relaxed"
          style={{ color: "var(--color-body)" }}
        >
          <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
            <input
              ref={consentRef}
              type="checkbox"
              checked={consent}
              onChange={(event) => {
                setConsent(event.target.checked);
                setConsentAsked(false);
              }}
              aria-describedby={consentMissing ? consentHintId : undefined}
              className="peer size-5 cursor-pointer appearance-none rounded-md border-2 transition-colors duration-150 checked:border-[var(--color-main)] checked:bg-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] motion-reduce:transition-none"
              style={{
                borderColor: consent
                  ? undefined
                  : consentMissing
                    ? "var(--color-danger)"
                    : "var(--color-secondary)",
              }}
            />
            <CheckIcon
              size={14}
              strokeWidth={3}
              aria-hidden
              className="pointer-events-none absolute opacity-0 peer-checked:opacity-100"
              style={{ color: "var(--color-bg)" }}
            />
          </span>
          <span>
            {consentText}
            <span
              className="mt-1 block"
              style={{ color: "var(--color-secondary)" }}
            >
              <LegalLink slug="mesafeli-satis-sozlesmesi" tone="plain">
                {tLegal("consent_distance_sales")}
              </LegalLink>
              {" · "}
              <LegalLink slug="on-bilgilendirme-formu" tone="plain">
                {tLegal("consent_pre_info")}
              </LegalLink>{" "}
              {tLegal("consent_confirm")}
            </span>
          </span>
        </label>
      ) : (
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {tSub(mode === "store" ? "store_handoff" : "payments_coming_soon")}
        </p>
      )}

      {consentMissing ? (
        <p
          id={consentHintId}
          role="alert"
          className="text-xs font-semibold"
          style={{ color: "var(--color-danger)" }}
        >
          {tSub("consent_needed")}
        </p>
      ) : null}

      <FormError message={error} />

      {purchaseEnabled ? (
        <Button
          fullWidth
          className="min-h-[60px]"
          disabled={!view || !selected || !selected.purchaseEnabled || view.entitlement.isPremium || (includesTrial && !view.trialEligibility.eligible)}
          busy={busy}
          onClick={start}
        >
          {tSub(includesTrial ? "start_trial" : "start_paid")}
        </Button>
      ) : mode === "store" ? (
        <StoreButtons links={getStoreLinks()} />
      ) : (
        <Button fullWidth className="min-h-[60px]" disabled>
          {tSub("coming_soon")}
        </Button>
      )}
    </motion.div>
  );

  return footer;
}
