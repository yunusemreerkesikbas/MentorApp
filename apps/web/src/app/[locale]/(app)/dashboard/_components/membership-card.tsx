"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { BarChart3, ChevronRight, Coins, MessageCircle, type LucideIcon } from "lucide-react";
import type { AdRewardOfferView, PromotionOffersView } from "@mentor/types";
import { PremiumBadge } from "@/components/premium/premium-badge";
import { TopBanner, type TopBannerItem } from "@/components/top-banner";
import { Link } from "@/i18n/navigation";
import { usePremiumPaywall } from "@/lib/premium-paywall";
import { formatPromotionMagnitude, pickBannerPromotion } from "@/lib/promotions";
import { useSubscription } from "@/lib/subscription-context";
import { PANEL_CARD, PANEL_CARD_TITLE, PANEL_TEXT_LINK } from "./panel-styles";

/**
 * Membership, in the rail. A member sees what membership gives them; a free user sees one
 * commercial ask (a real discount if there is one, the trial otherwise, never both) taking turns
 * with the rewarded-coin offer inside the announcement card.
 */
export function MembershipCard({
  promotionOffers,
  rewardOffer,
  rewardUnavailable,
  onOpenQuests,
}: {
  promotionOffers: PromotionOffersView | null | undefined;
  rewardOffer: AdRewardOfferView | null;
  rewardUnavailable: boolean;
  onOpenQuests: () => void;
}) {
  const t = useTranslations("panel");
  const paywallT = useTranslations("paywall");
  const campaignT = useTranslations("campaign");
  const adsT = useTranslations("ads");
  const locale = useLocale();
  const { openPaywall } = usePremiumPaywall();
  const { view, loading } = useSubscription();

  // Nothing until both answers are in: an upsell that flashes at a member is worse than one that
  // arrives a moment late, and a card that reshuffles under the reader is worse than a beat of
  // silence (the rewarded offer is the faster feed and would otherwise lead, then get bumped).
  if (loading || !view || promotionOffers === undefined) return null;
  if (view.entitlement.isPremium) return <PremiumPerks />;

  const promotion = pickBannerPromotion(promotionOffers, false);
  const campaignArt = (
    <Image
      src="/img/campaign.png"
      alt=""
      width={96}
      height={96}
      className="size-16 object-contain xl:size-24"
    />
  );
  const commercial: TopBannerItem = promotion
    ? {
        id: "promotion",
        visual: campaignArt,
        // Leads with the size of the discount: the campaign NAME means nothing to someone who
        // has not opened the modal.
        message: paywallT("banner_message", {
          amount: formatPromotionMagnitude(promotion, locale, (value) =>
            paywallT("discount_percent", { value }),
          ),
          label: promotion.label,
        }),
        action: {
          kind: "button",
          label: paywallT("banner_cta"),
          // Same hand-over as the modal: a coded campaign reaches checkout without retyping.
          onSelect: () =>
            openPaywall(promotion.code ? { code: promotion.code } : undefined),
        },
      }
    : {
        id: "premium-trial",
        visual: campaignArt,
        title: campaignT("eyebrow"),
        message: campaignT("title"),
        action: {
          kind: "button",
          label: t("membership_trial_cta"),
          onSelect: () => openPaywall(),
        },
      };
  const rewarded: TopBannerItem[] =
    rewardOffer?.eligible && rewardOffer.adUnitPath && !rewardUnavailable
      ? [
          {
            id: "rewarded-coin",
            // Static on purpose: the animated coin SVG would spin in the rail forever.
            visual: (
              <Coins
                className="size-10 text-[color-mix(in_srgb,var(--color-star)_55%,var(--color-main))] xl:size-14"
                strokeWidth={1.75}
                aria-hidden
              />
            ),
            message: adsT("top_banner.message", {
              count: rewardOffer.rewardCoin * rewardOffer.dailyRemaining,
            }),
            action: {
              kind: "button",
              label: adsT("top_banner.cta"),
              onSelect: onOpenQuests,
            },
          },
        ]
      : [];

  // What expires leads: a campaign ends, the coin offer resets daily, the trial is always there.
  return (
    <TopBanner
      closeLabel={adsT("top_banner.close")}
      items={promotion ? [commercial, ...rewarded] : [...rewarded, commercial]}
    />
  );
}

function PremiumPerks() {
  const t = useTranslations("panel");

  return (
    <section
      className={`${PANEL_CARD} flex flex-col gap-2`}
      aria-labelledby="premium-perks-title"
      data-testid="premium-perks-card"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="premium-perks-title" className={PANEL_CARD_TITLE}>
          {t("perks_title")}
        </h2>
        <PremiumBadge />
      </div>
      <ul className="flex flex-col">
        <PerkLink
          href="/analysis"
          icon={BarChart3}
          title={t("perks_analysis")}
          caption={t("perks_analysis_caption")}
        />
        <PerkLink
          href="/coach"
          icon={MessageCircle}
          title={t("perks_coach")}
          caption={t("perks_coach_caption")}
        />
      </ul>
      <Link href="/subscription" className={`${PANEL_TEXT_LINK} -mb-2 self-start`}>
        {t("perks_manage")}
      </Link>
    </section>
  );
}

function PerkLink({
  href,
  icon: Icon,
  title,
  caption,
}: {
  href: "/analysis" | "/coach";
  icon: LucideIcon;
  title: string;
  caption: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--premium-ring-from)_12%,var(--color-surface))] text-[var(--premium-ring-from)]">
          <Icon className="size-5" strokeWidth={2.2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-[var(--color-main)]">
            {title}
          </span>
          <span className="block text-caption text-[var(--color-secondary)]">
            {caption}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-[var(--color-secondary)]" aria-hidden />
      </Link>
    </li>
  );
}
