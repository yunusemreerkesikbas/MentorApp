"use client";

import { useEffect, useRef, useState } from "react";
import type { PromotionSummary } from "@mentor/types";
import { usePremiumPaywall } from "@/lib/premium-paywall";
import { fetchAutoPromotionOffers, pickPromotionForDialog } from "@/lib/promotions";
import { readIdSet, writeIdSet } from "@/lib/seen-ids";
import { fetchSubscriptionView } from "@/lib/subscription-view";
import { PromotionCard } from "./promotion-card";

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

export function PromotionDialog() {
  const { openPaywall } = usePremiumPaywall();
  const [promotion, setPromotion] = useState<PromotionSummary | null>(null);

  // Fire-once-per-visit, guarded by a ref rather than a cancellation flag. Under StrictMode the
  // effect runs, is cleaned up, then runs again; a per-run `cancelled` flag would be set by the
  // FIRST cleanup while that run's card is still on screen, so the user's click would resolve
  // into a closure that had already given up — the CTA would silently do nothing.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      // A failure here must never surface: this is a bonus, not a feature the user asked for.
      // Both fetches are deduped module-side, so this rides the requests the dashboard already makes.
      const [view, offers] = await Promise.all([
        fetchSubscriptionView(),
        fetchAutoPromotionOffers(),
      ]);
      if (!offers) return;
      if (view?.entitlement.isPremium !== false) return; // Premium (or unknown) — no commercial nudge.

      const seen = readIdSet("local", SEEN_KEY);
      const next = pickPromotionForDialog(offers, seen);
      // Nothing new to announce — leave the record untouched and check again next visit.
      if (!next) return;

      writeIdSet("local", SEEN_KEY, new Set(seen).add(next.id));
      setPromotion(next);
    })();
  }, []);

  if (!promotion) return null;

  return (
    <PromotionCard
      promotion={promotion}
      onClose={() => setPromotion(null)}
      onContinue={(code) => {
        setPromotion(null);
        // Hand the coupon over so the paywall applies it — the user never retypes it.
        openPaywall(code ? { code } : undefined);
      }}
    />
  );
}
