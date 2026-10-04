"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { PlanDto, PromotionOfferView, SubscriptionView } from "@mentor/types";
import { Button, Card } from "@mentor/ui";
import { LegalLink } from "@/components/legal-link";
import { SubscriptionPurchaseChoice } from "@/components/premium/subscription-purchase-choice";
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
  const [wantsTrial, setWantsTrial] = useState(false);
  const [consent, setConsent] = useState(false);
  const formatPrice = (minor: number) => (minor / 100).toLocaleString(locale, { style: "currency", currency: "TRY" });
  const price = formatPrice(offer?.chargedPriceMinor ?? plan.priceMinor);
  const discount = offer && offer.discountMinor > 0 ? offer : null;
  const consentText = discount
    ? t(discount.promotion && discount.promotion.appliesToPeriods > 1
      ? wantsTrial ? "trial_consent_discounted_periods" : "consent_discounted_periods"
      : wantsTrial ? "trial_consent_discounted" : "consent_discounted", {
        trialDays: plan.trialDays,
        periods: discount.promotion?.appliesToPeriods ?? 1,
        introPrice: price,
        renewalPrice: formatPrice(discount.renewalPriceMinor),
      })
    : wantsTrial ? t("trial_consent_days", { days: plan.trialDays }) : t("paid_consent", { price });
  return (
    <Card className="flex h-full flex-col gap-3">
      <p className="text-lg font-extrabold text-[var(--color-main)]">{plan.name}</p>
      <p className="text-2xl font-extrabold tabular-nums text-[var(--color-main)]">
        {price}<span className="text-sm font-semibold text-[var(--color-secondary)]"> {t("period_suffix", { months: plan.periodMonths })}</span>
      </p>
      {mode === "checkout" && plan.purchaseEnabled ? (
        <>
          <SubscriptionPurchaseChoice eligibility={view?.trialEligibility} trialDays={plan.trialDays} wantsTrial={wantsTrial} onChange={(next) => { setWantsTrial(next); setConsent(false); }} onPhoneVerified={onPhoneVerified} />
          <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed text-[var(--color-body)]">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--color-btn)]" />
            <span>
              {consentText}
              <span className="mt-2 block text-[var(--color-secondary)]">
                <LegalLink slug="mesafeli-satis-sozlesmesi">{legal("consent_distance_sales")}</LegalLink>{" · "}
                <LegalLink slug="on-bilgilendirme-formu">{legal("consent_pre_info")}</LegalLink>{" "}{legal("consent_confirm")}
              </span>
            </span>
          </label>
          <Button disabled={!consent || (wantsTrial && !view?.trialEligibility.eligible)} busy={busy} onClick={() => onCheckout(plan, wantsTrial)} className="!min-h-11 !px-4 !py-2 !text-sm">
            {t(wantsTrial ? "start_trial" : "start_paid")}
          </Button>
        </>
      ) : mode === "store" ? null : <Button disabled className="!min-h-11 !px-4 !py-2 !text-sm">{t("coming_soon")}</Button>}
    </Card>
  );
}
