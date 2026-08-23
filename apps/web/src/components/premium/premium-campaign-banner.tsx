"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { fetchSubscriptionView } from "@/lib/subscription-view";
import { usePremiumPaywall } from "@/lib/premium-paywall";

/**
 * Shared rail campaign — free users only. Opens the paywall; no fake discount.
 */
export function PremiumCampaignBanner({ className }: { className?: string }) {
  const t = useTranslations("campaign");
  const { openPaywall } = usePremiumPaywall();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    fetchSubscriptionView().then((view) => {
      if (!active) return;
      setVisible(view != null && !view.entitlement.isPremium);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      data-testid="premium-campaign-banner"
      onClick={() => openPaywall()}
      aria-label={t("cta_aria")}
      className={`premium-campaign-banner flex min-h-24 w-full items-center gap-1 rounded-[var(--radius-card)] px-4 py-4 text-left transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 ${className ?? ""}`}
    >
      <span className="relative size-[72px] shrink-0">
        <Image
          src="/img/campaign.png"
          alt=""
          fill
          sizes="72px"
          className="object-contain"
        />
      </span>
      <span className="min-w-0">
        <span
          className="block text-balance text-base font-bold leading-snug"
          style={{
            color: "var(--campaign-ink)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {t("eyebrow")}
        </span>
        <span
          className="mt-1 block text-xs font-semibold leading-snug"
          style={{ color: "var(--campaign-muted)" }}
        >
          {t("title")}
        </span>
      </span>
    </button>
  );
}
