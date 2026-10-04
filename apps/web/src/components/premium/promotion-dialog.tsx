"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { PromotionOffersView, PromotionSummary } from "@mentor/types";
import { usePremiumPaywall } from "@/lib/premium-paywall";
import { pickPromotionForDialog } from "@/lib/promotions";
import { readIdSet, writeIdSet } from "@/lib/seen-ids";
import { useSubscription } from "@/lib/subscription-context";

const PromotionCard = dynamic(() =>
  import("./promotion-card").then((module) => module.PromotionCard),
);

/**
 * Announces a campaign once, the first time a qualifying free user lands on the dashboard.
 *
 * Everything the user reads comes from the promotion itself — the admin writes the label and the
 * code, so a campaign can be renamed, re-priced or retired from the panel without a deploy. The
 * title IS the label, which is what makes one component serve a welcome gift and an August sale
 * without knowing either exists.
 *
 * Keyed on campaign id rather than a single "seen" flag: a second campaign gets its own single
 * appearance instead of being swallowed by the first one's flag.
 *
 * Surface priority (docs/features/promotions.md): modal, once per campaign > dashboard strip >
 * rail card. The modal sits above the strip as a portal, so a user who dismisses it still finds
 * the offer waiting — that overlap is the intended handoff, not a collision.
 *
 * ponytail: localStorage, so clearing storage or switching device can show it again. Harmless —
 * the promotion enforces its own per-user cap server-side. Move to the server-persisted
 * show-once pattern (`user_journey_level_celebrations`) only if it ever needs to be exact.
 */
const SEEN_KEY = "mentor.promotion-dialog.seen.v1";

export function PromotionDialog({ offers }: { offers: PromotionOffersView | null | undefined }) {
  const { openPaywall } = usePremiumPaywall();
  const { view, loading } = useSubscription();
  const [promotion, setPromotion] = useState<PromotionSummary | null>(null);

  // Fire once per visit, after the panel has finished resolving the shared offer and entitlement.
  const startedRef = useRef(false);

  useEffect(() => {
    if (loading || offers === undefined || startedRef.current) return;
    const frame = requestAnimationFrame(() => {
      if (startedRef.current) return;
      startedRef.current = true;
      if (!offers || view?.entitlement.isPremium !== false) return;

      const seen = readIdSet("local", SEEN_KEY);
      const next = pickPromotionForDialog(offers, seen);
      if (!next) return;

      // Yield to an earned moment, such as a journey celebration, without marking the offer seen.
      // Every modal carries this accessible role, so a separate registry is unnecessary.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;

      setPromotion(next);
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, offers, view]);

  if (!promotion) return null;

  return (
    <PromotionCard
      promotion={promotion}
      onShown={() => {
        const seen = readIdSet("local", SEEN_KEY);
        writeIdSet("local", SEEN_KEY, new Set(seen).add(promotion.id));
      }}
      onClose={() => setPromotion(null)}
      onContinue={(code) => {
        setPromotion(null);
        // Hand the coupon over so the paywall applies it — the user never retypes it.
        openPaywall(code ? { code } : undefined);
      }}
    />
  );
}
