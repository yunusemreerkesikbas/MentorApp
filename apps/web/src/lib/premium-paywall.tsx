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

  const openPaywall = useCallback((options?: PaywallOpenOptions) => {
    setSourceFeature(options?.sourceFeature);
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
