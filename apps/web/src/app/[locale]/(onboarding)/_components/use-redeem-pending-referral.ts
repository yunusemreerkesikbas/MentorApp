"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import { notifyEconomyChanged, redeemInviteCode } from "@/lib/economy";
import { useMentorToast } from "@/lib/mentor-toast";
import { consumePendingReferral } from "@/lib/pending-referral";
import { useAppAvailability } from "@/lib/app-availability";
import type { OnboardingAudience } from "./onboarding-flow";

/**
 * Redeems the friend's invite code a landing page remembered, once onboarding is over.
 *
 * Fire and forget by design: finishing onboarding must never wait on, or fail because of, the
 * referral. The code is consumed up front, so a second call (a double click, a re-render) finds
 * nothing to redeem. The outcome is a toast, which lives above the router and so survives the
 * navigation away from the wizard; a refusal carries the API's own localized message, never a
 * silent swallow. A coach is outside the invite economy: their code is dropped without a request.
 */
export function useRedeemPendingReferral(): (audience: OnboardingAudience) => void {
  const t = useTranslations("economy");
  const { success, error } = useMentorToast();
  const availability = useAppAvailability();

  return useCallback(
    (audience) => {
      const code = consumePendingReferral();
      if (!code || audience !== "student" || !availability?.invites) return;
      redeemInviteCode(code)
        .then(() => {
          notifyEconomyChanged();
          success({ title: t("redeem_saved") });
        })
        .catch((err: unknown) => {
          error({
            title: t("redeem_failed"),
            message: err instanceof ApiClientError ? err.body.message : undefined,
          });
        });
    },
    [error, success, t, availability?.invites],
  );
}
