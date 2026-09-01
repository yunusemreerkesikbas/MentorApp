"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PremiumFeatureId } from "@mentor/types";
import { PremiumPaywallModal } from "@/components/premium/premium-paywall-modal";

export interface PaywallOpenOptions {
  sourceFeature?: PremiumFeatureId;
  /**
   * A coupon to apply on open, so a campaign surface can hand the user straight to a discounted
   * paywall instead of asking them to retype what it just showed them. Advisory: the paywall
   * re-resolves it server-side and falls back to the list price if it no longer applies.
   */
  code?: string;
}

interface PremiumPaywallContextValue {
  openPaywall: (options?: PaywallOpenOptions) => void;
  closePaywall: () => void;
}

const PremiumPaywallContext = createContext<PremiumPaywallContextValue | null>(
  null,
);

export function PremiumPaywallProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [sourceFeature, setSourceFeature] = useState<PremiumFeatureId | undefined>();
  const [code, setCode] = useState<string | undefined>();

  const openPaywall = useCallback((options?: PaywallOpenOptions) => {
    setSourceFeature(options?.sourceFeature);
    setCode(options?.code);
    setOpen(true);
  }, []);

  const closePaywall = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({ openPaywall, closePaywall }),
    [closePaywall, openPaywall],
  );

  return (
    <PremiumPaywallContext.Provider value={value}>
      {children}
      {open ? (
        <PremiumPaywallModal
          sourceFeature={sourceFeature}
          initialCode={code}
          onClose={closePaywall}
        />
      ) : null}
    </PremiumPaywallContext.Provider>
  );
}

export function usePremiumPaywall(): PremiumPaywallContextValue {
  const ctx = useContext(PremiumPaywallContext);
  if (!ctx) {
    throw new Error("usePremiumPaywall must be used within PremiumPaywallProvider");
  }
  return ctx;
}
