"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { usePremiumPaywall } from "@/lib/premium-paywall";
import { fetchAutoPromotionOffers, pickWelcomeGift } from "@/lib/promotions";
import { fetchSubscriptionView } from "@/lib/subscription-view";

/**
 * Shown once, the first time a user who qualifies for a promotion lands on the dashboard.
 *
 * The coupon code is DATA — whatever the admin created — never a string in this file, so the
 * welcome gift can be renamed, re-priced or retired from the panel without a deploy. Works for
 * both promotion shapes: a coded one is shown with its code to type, a code-less one is announced
 * as already applied.
 *
 * ponytail: localStorage once-flag, so a user who clears storage or switches device may see it
 * twice. Harmless — the promotion has its own per-user cap. Move to the server-persisted
 * show-once pattern (`user_journey_level_celebrations`) if it ever needs to be exact.
 */
const SEEN_KEY = "mentor.welcome-gift.seen.v1";

function alreadySeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // Private mode / blocked storage: showing it again is better than crashing the dashboard.
    return false;
  }
}

function markSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Ignore — the dialog simply may reappear.
  }
}

export function WelcomeGiftDialog() {
  const t = useTranslations("paywall");
  const { promo } = useMentorDialog();
  const { openPaywall } = usePremiumPaywall();

  useEffect(() => {
    if (alreadySeen()) return;
    let cancelled = false;

    void (async () => {
      // A failure here must never surface: this is a bonus, not a feature the user asked for.
      // `fetchSubscriptionView` is deduped, so this rides the request the rail already makes.
      const [view, offers] = await Promise.all([
        fetchSubscriptionView(),
        fetchAutoPromotionOffers(),
      ]);
      if (cancelled || !offers) return;
      if (view?.entitlement.isPremium !== false) return; // Premium (or unknown) — nothing to offer.

      const gift = pickWelcomeGift(offers);
      if (!gift) return; // Nothing to celebrate — leave the flag unset and try again next visit.

      markSeen();
      const result = await promo({
        title: t("welcome_title"),
        message: gift.code
          ? t("welcome_body_code", { label: gift.label, code: gift.code })
          : t("welcome_body_auto", { label: gift.label }),
        primaryLabel: t("welcome_cta"),
        puhuVariant: "encouraging",
      });
      if (cancelled || result !== "primary") return;
      openPaywall();
    })();

    return () => {
      cancelled = true;
    };
  }, [openPaywall, promo, t]);

  return null;
}
