"use client";

import { useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { PlanDto, PromotionOfferView, SubscriptionView } from "@mentor/types";
import { Button, Card } from "@mentor/ui";
import { LegalLink } from "@/components/legal-link";
import { SubscriptionTrialNotice } from "@/components/premium/subscription-trial-notice";
import { includesSubscriptionTrial } from "@/lib/subscription-trial";
import type { PurchaseMode } from "@/lib/purchase-mode";

interface SubscriptionPlanCardProps {
  plan: PlanDto;
  view: SubscriptionView | null;
  mode: PurchaseMode;
  offer?: PromotionOfferView;
  busy: boolean;
  onCheckout: (plan: PlanDto, useTrial: boolean) => void;
  onPhoneVerified: () => void;
}

export function SubscriptionPlanCard({ plan, view, mode, offer, busy, onCheckout, onPhoneVerified }: SubscriptionPlanCardProps) {
  const t = useTranslations("subscription");
  const legal = useTranslations("legal");
  const locale = useLocale();
  const includesTrial = includesSubscriptionTrial(plan, view?.trialEligibility);
  const [acceptedConsent, setAcceptedConsent] = useState<string | null>(null);
  const formatPrice = (minor: number) => (minor / 100).toLocaleString(locale, { style: "currency", currency: "TRY" });
  const price = formatPrice(offer?.chargedPriceMinor ?? plan.priceMinor);
  const discount = offer && offer.discountMinor > 0 ? offer : null;
  const consentText = discount
    ? t(discount.promotion && discount.promotion.appliesToPeriods > 1
      ? includesTrial ? "trial_consent_discounted_periods" : "consent_discounted_periods"
      : includesTrial ? "trial_consent_discounted" : "consent_discounted", {
        trialDays: plan.trialDays,
        periods: discount.promotion?.appliesToPeriods ?? 1,
        introPrice: price,
        renewalPrice: formatPrice(discount.renewalPriceMinor),
      })
    : includesTrial ? t("trial_consent_days", { days: plan.trialDays }) : t("paid_consent", { price });
  const consent = acceptedConsent === consentText;
  const consentRef = useRef<HTMLInputElement>(null);
  const consentHintId = useId();
  // Same as the paywall: the CTA stays live and, pressed without consent, points at the box.
  const [consentAsked, setConsentAsked] = useState(false);
  const consentMissing = consentAsked && !consent;
  function start() {
    if (!consent) {
      setConsentAsked(true);
      consentRef.current?.focus();
      return;
    }
    onCheckout(plan, includesTrial);
  }
  return (
    <Card className="flex h-full flex-col gap-3">
      <p className="text-lg font-extrabold text-[var(--color-main)]">{plan.name}</p>
      <p className="text-2xl font-extrabold tabular-nums text-[var(--color-main)]">
        {price}<span className="text-sm font-semibold text-[var(--color-secondary)]"> {t("period_suffix", { months: plan.periodMonths })}</span>
      </p>
      {mode === "checkout" && plan.purchaseEnabled ? (
        <>
          <SubscriptionTrialNotice eligibility={view?.trialEligibility} trialDays={plan.trialDays} onPhoneVerified={() => { setAcceptedConsent(null); onPhoneVerified(); }} />
          <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed text-[var(--color-body)]">
            <input ref={consentRef} type="checkbox" checked={consent} onChange={(event) => { setAcceptedConsent(event.target.checked ? consentText : null); setConsentAsked(false); }} aria-describedby={consentMissing ? consentHintId : undefined} className={`mt-0.5 size-5 shrink-0 accent-[var(--color-btn)] ${consentMissing ? "outline-2 outline-offset-2 outline-[var(--color-danger)]" : ""}`} />
            <span>
              {consentText}
              <span className="mt-2 block text-[var(--color-secondary)]">
                <LegalLink slug="mesafeli-satis-sozlesmesi">{legal("consent_distance_sales")}</LegalLink>{" · "}
                <LegalLink slug="on-bilgilendirme-formu">{legal("consent_pre_info")}</LegalLink>{" "}{legal("consent_confirm")}
              </span>
            </span>
          </label>
          {consentMissing ? <p id={consentHintId} role="alert" className="text-sm font-semibold text-[var(--color-danger)]">{t("consent_needed")}</p> : null}
          <Button disabled={!view || (includesTrial && !view.trialEligibility.eligible)} busy={busy} onClick={start} className="!min-h-11 !px-4 !py-2 !text-sm">
            {t(includesTrial ? "start_trial" : "start_paid")}
          </Button>
        </>
      ) : mode === "store" ? null : <Button disabled className="!min-h-11 !px-4 !py-2 !text-sm">{t("coming_soon")}</Button>}
    </Card>
  );
}
