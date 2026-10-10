"use client";

import { useEffect, useState } from "react";
import type { PlanDto, PromotionOffersView, SubscriptionView } from "@mentor/types";
import {
  ApiClientError,
  subscriptionsControllerCheckout,
  subscriptionsControllerGetMine,
  subscriptionsControllerListPlans,
} from "@mentor/api-client";
import { trackProductEvent } from "@/lib/analytics";
import { buildBeginCheckoutParams } from "@/lib/checkout-analytics";
import { fetchAutoPromotionOffers, fetchPromotionOffers } from "@/lib/promotions";
import { getStoreLinks, plansForAudience, purchaseMode } from "@/lib/purchase-mode";
import { includesSubscriptionTrial } from "@/lib/subscription-trial";

function apiMessage(err: unknown): string {
  return err instanceof ApiClientError || err instanceof Error ? err.message : String(err);
}

export function usePremiumPaywall(initialCode?: string) {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [view, setView] = useState<SubscriptionView | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offers, setOffers] = useState<PromotionOffersView | null>(null);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    /**
     * With a handed-over coupon, resolve WITH it and remember it as applied. A stale or
     * now-ineligible code must not break the paywall, so a rejection falls back to the automatic
     * offer and the user simply sees the list price — never an error blocking a purchase.
     */
    const loadOffers = initialCode
      ? fetchPromotionOffers(initialCode)
          .then((resolved) => ({ resolved, applied: initialCode }))
          .catch(async () => ({ resolved: await fetchAutoPromotionOffers(), applied: null }))
      : fetchAutoPromotionOffers().then((resolved) => ({ resolved, applied: null }));

    Promise.all([
      subscriptionsControllerListPlans(),
      subscriptionsControllerGetMine(),
      loadOffers,
    ])
      .then(([planRows, subscriptionView, promotionOffers]) => {
        if (!active) return;
        // The paywall sells student Premium; seat plans are a coach's purchase on /abonelik.
        const nextPlans = plansForAudience(planRows as unknown as PlanDto[], false);
        setPlans(nextPlans);
        setView(subscriptionView as unknown as SubscriptionView);
        setOffers(promotionOffers.resolved);
        if (promotionOffers.applied) {
          setAppliedCode(promotionOffers.applied);
          setCouponOpen(true);
        }
        setSelectedId(nextPlans[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoadError(
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // The modal mounts fresh on every open and the provider sets `initialCode` before mounting,
    // so this runs once per open — it is not a live subscription to the prop.
  }, [initialCode]);

  const mode = purchaseMode(plans, getStoreLinks());
  const purchaseEnabled = mode === "checkout";
  const pendingTrial = view?.trialEligibility?.reason === "PENDING";
  const pendingCheckout = view?.subscription?.status === "INCOMPLETE" || pendingTrial;
  const selected = plans.find((plan) => plan.id === selectedId) ?? plans[0];
  const includesTrial = includesSubscriptionTrial(selected, view?.trialEligibility);
  const selectedOffer = selected ? offers?.offers[selected.id] : undefined;
  const selectedDiscount =
    selectedOffer && selectedOffer.discountMinor > 0 ? selectedOffer : undefined;

  async function checkout() {
    if (!selected || !view || busy || pendingCheckout) return;
    setError(null);
    setBusy(true);
    trackProductEvent(
      "begin_checkout",
      buildBeginCheckoutParams(selected, selectedDiscount?.chargedPriceMinor),
    );
    try {
      const session = (await subscriptionsControllerCheckout({
        planId: selected.id,
        useTrial: includesTrial,
        ...(appliedCode ? { code: appliedCode } : {}),
      })) as unknown as { checkoutUrl: string };
      window.location.assign(session.checkoutUrl);
    } catch (err) {
      setConsent(false);
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err),
      );
      // An ambiguous provider response can have persisted an intent. Read it before retrying.
      try {
        setView(await subscriptionsControllerGetMine() as unknown as SubscriptionView);
      } catch (readError) {
        setView(null);
        setLoadError(apiMessage(readError));
      }
      setBusy(false);
    }
  }

  async function refreshEligibility() {
    setConsent(false);
    try {
      setView(await subscriptionsControllerGetMine() as unknown as SubscriptionView);
    } catch (err) {
      setError(apiMessage(err));
    }
  }

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      // The API rejects an unusable code with the same localized error checkout would raise,
      // so what the user reads here is exactly what would have stopped the purchase.
      setOffers(await fetchPromotionOffers(code));
      setAppliedCode(code);
    } catch (err) {
      setCouponError(apiMessage(err));
    } finally {
      setCouponBusy(false);
    }
  }

  async function clearCoupon() {
    setAppliedCode(null);
    setCouponInput("");
    setCouponError(null);
    setOffers(await fetchAutoPromotionOffers());
  }

  function selectPlan(id: string) {
    setSelectedId(id);
    setConsent(false);
  }

  return {
    loading, plans, view, selected, consent, setConsent, error, busy, loadError,
    offers, selectedDiscount, mode, purchaseEnabled, pendingTrial, pendingCheckout,
    includesTrial, couponOpen, setCouponOpen, couponInput, setCouponInput, appliedCode,
    couponBusy, couponError, checkout, refreshEligibility, applyCoupon, clearCoupon,
    selectPlan,
  };
}

export type PremiumPaywallState = ReturnType<typeof usePremiumPaywall>;
