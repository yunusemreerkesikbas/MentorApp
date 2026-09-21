"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PremiumFeatureId, SubscriptionView } from "@mentor/types";
import { isPremiumFeatureAvailable } from "@/lib/premium-feature";
import { fetchSubscriptionView } from "@/lib/subscription-view";

/**
 * One subscription read per app load.
 *
 * `GET /v1/subscription` used to run about three times on the panel alone — AppNav fetched it
 * directly, `fetchSubscriptionView` deduped only while a request was in flight (it forgets the
 * result), and the vision card asked `/coach/access` a fourth time for the same question. Every
 * caller wanted the same document, so it is read here once and shared.
 *
 * `refresh()` exists for the moments the answer really changes: checkout returning, the paywall
 * closing after a purchase.
 */
interface SubscriptionState {
  view: SubscriptionView | null;
  /** True until the first read settles — chrome that would flash should wait on this. */
  loading: boolean;
  refresh: () => Promise<SubscriptionView | null>;
}

const FALLBACK: SubscriptionState = {
  view: null,
  loading: false,
  refresh: fetchSubscriptionView,
};

const SubscriptionContext = createContext<SubscriptionState | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<SubscriptionView | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    const next = await fetchSubscriptionView();
    if (!alive.current) return next;
    setView(next);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ view, loading, refresh }),
    [view, loading, refresh],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

/**
 * Outside a provider this degrades to "nothing known yet" rather than throwing: a premium card
 * that silently stays hidden is the same thing a failed fetch already does, while a crash would
 * take the whole screen down.
 */
export function useSubscription(): SubscriptionState {
  const value = useContext(SubscriptionContext);
  if (!value && process.env.NODE_ENV !== "production") {
    console.warn("useSubscription() outside SubscriptionProvider — premium state stays empty.");
  }
  return value ?? FALLBACK;
}

export function useIsPremium(): boolean {
  return Boolean(useSubscription().view?.entitlement.isPremium);
}

/** Premium, or the capped free taste an admin switched on for this feature. */
export function usePremiumFeature(featureId: PremiumFeatureId): boolean {
  return isPremiumFeatureAvailable(useSubscription().view, featureId);
}
