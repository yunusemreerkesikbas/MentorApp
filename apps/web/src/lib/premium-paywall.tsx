"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { PremiumFeatureId } from "@mentor/types";
import { useAppAvailability } from "./app-availability";
import { useAuth } from "./auth-context";
import { isCoach } from "./coach-surface";
import { useMentorToast } from "./mentor-toast";

const PremiumPaywallModal = dynamic(
  () => import("@/components/premium/premium-paywall-modal").then((module) => module.PremiumPaywallModal),
  { ssr: false },
);

export interface PaywallOpenOptions {
  sourceFeature?: PremiumFeatureId;
  /** Optional contextual headline when opened from a quota/usage limit (e.g. notebook limits). */
  headline?: string;
  /** Optional contextual subtitle explaining which free limit was reached. */
  subtitle?: string;
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
  const availability = useAppAvailability();
  const { user } = useAuth();
  const purchaseAvailable = isCoach(user) ? availability?.coachPurchases : availability?.studentPurchases;
  const t = useTranslations("paywall");
  const { info } = useMentorToast();
  const [open, setOpen] = useState(false);
  const [sourceFeature, setSourceFeature] = useState<PremiumFeatureId | undefined>();
  const [headline, setHeadline] = useState<string | undefined>();
  const [subtitle, setSubtitle] = useState<string | undefined>();
  const [code, setCode] = useState<string | undefined>();

  const openPaywall = useCallback((options?: PaywallOpenOptions) => {
    if (!purchaseAvailable) {
      info({ title: t("closed_title"), message: t("closed_body") });
      return;
    }
    setSourceFeature(options?.sourceFeature);
    setHeadline(options?.headline);
    setSubtitle(options?.subtitle);
    setCode(options?.code);
    setOpen(true);
  }, [purchaseAvailable, info, t]);

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
      {open && purchaseAvailable ? (
        <PremiumPaywallModal
          sourceFeature={sourceFeature}
          headline={headline}
          subtitle={subtitle}
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
