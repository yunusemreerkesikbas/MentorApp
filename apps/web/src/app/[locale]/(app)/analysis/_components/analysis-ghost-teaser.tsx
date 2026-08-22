"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@mentor/ui";
import { EmptyState } from "@/components/empty-state";
import { PremiumLockNudge } from "@/components/premium/premium-lock-nudge";
import { isPremiumFeatureAvailable } from "@/lib/premium-feature";
import { usePremiumPaywall } from "@/lib/premium-paywall";
import { fetchSubscriptionView } from "@/lib/subscription-view";

export function AnalysisGhostTeaser() {
  const t = useTranslations("analysis");
  const tGhost = useTranslations("ghost");
  const { openPaywall } = usePremiumPaywall();
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let active = true;
    fetchSubscriptionView().then((view) => {
      if (active) {
        setLocked(!isPremiumFeatureAvailable(view, "ghost.narration"));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <EmptyState
        title={t("ghost_teaser_title")}
        description={t("ghost_teaser_desc")}
        puhuVariant="encouraging"
        action={
          locked ? (
            <PremiumLockNudge
              label={tGhost("premium_nudge")}
              onClick={() => openPaywall({ sourceFeature: "ghost.narration" })}
            />
          ) : undefined
        }
      />
    </Card>
  );
}
