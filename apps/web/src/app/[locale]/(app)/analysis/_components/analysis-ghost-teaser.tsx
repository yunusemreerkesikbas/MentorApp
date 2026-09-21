"use client";

import { useTranslations } from "next-intl";
import { Card } from "@mentor/ui";
import { EmptyState } from "@/components/empty-state";
import { PremiumLockNudge } from "@/components/premium/premium-lock-nudge";
import { usePremiumPaywall } from "@/lib/premium-paywall";
import {
  usePremiumFeature,
  useSubscription,
} from "@/lib/subscription-context";

export function AnalysisGhostTeaser() {
  const t = useTranslations("analysis");
  const tGhost = useTranslations("ghost");
  const { openPaywall } = usePremiumPaywall();
  const { loading } = useSubscription();
  const allowed = usePremiumFeature("ghost.narration");
  // Unlocked until the entitlement is known, so the lock never flashes at a premium member.
  const locked = !loading && !allowed;

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
