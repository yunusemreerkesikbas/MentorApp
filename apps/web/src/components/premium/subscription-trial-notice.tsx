"use client";

import { useTranslations } from "next-intl";
import type { TrialEligibilityDto } from "@mentor/types";
import { PhoneVerificationCard } from "@/components/phone-verification-card";
import { includesSubscriptionTrial } from "@/lib/subscription-trial";

interface SubscriptionTrialNoticeProps {
  eligibility: TrialEligibilityDto | undefined;
  trialDays: number;
  onPhoneVerified: () => void;
}

/** Shows included-trial details and verification only when a trial applies. */
export function SubscriptionTrialNotice({ eligibility, trialDays, onPhoneVerified }: SubscriptionTrialNoticeProps) {
  const t = useTranslations("subscription");
  if (trialDays <= 0 || !eligibility) return null;
  const includesTrial = includesSubscriptionTrial({ trialDays }, eligibility);
  if (!includesTrial) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--color-body)]">
        {t("trial_included", { days: trialDays })}
      </p>
      <p className="text-caption text-[var(--color-secondary)]">{t("trial_phone_retention")}</p>
      {eligibility.reason === "PHONE_REQUIRED" ? (
        <PhoneVerificationCard onStatusChange={(phone) => { if (phone.verified) onPhoneVerified(); }} />
      ) : null}
    </div>
  );
}
