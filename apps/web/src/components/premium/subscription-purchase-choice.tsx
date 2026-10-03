"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import type { TrialEligibilityDto } from "@mentor/types";
import { PhoneVerificationCard } from "@/components/phone-verification-card";

interface SubscriptionPurchaseChoiceProps {
  eligibility: TrialEligibilityDto | undefined;
  trialDays: number;
  wantsTrial: boolean;
  onChange: (wantsTrial: boolean) => void;
  onPhoneVerified: () => void;
}

/** The server decides eligibility; the customer explicitly chooses a trial or an immediate charge. */
export function SubscriptionPurchaseChoice({ eligibility, trialDays, wantsTrial, onChange, onPhoneVerified }: SubscriptionPurchaseChoiceProps) {
  const t = useTranslations("subscription");
  const name = useId();
  if (trialDays <= 0) return null;
  const canChooseTrial = eligibility?.eligible || eligibility?.reason === "PHONE_REQUIRED";
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2 text-sm text-[var(--color-body)]">
        <legend className="mb-2 font-extrabold">{t("purchase_choice")}</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="radio" name={name} checked={!wantsTrial} onChange={() => onChange(false)} className="size-5 accent-[var(--color-btn)]" />
          {t("paid_choice")}
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="radio" name={name} checked={wantsTrial} disabled={!canChooseTrial} onChange={() => onChange(true)} className="size-5 accent-[var(--color-btn)]" />
          {t("trial_choice", { days: trialDays })}
        </label>
      </fieldset>
      {wantsTrial ? <p className="text-caption text-[var(--color-secondary)]">{t("trial_phone_retention")}</p> : null}
      {eligibility && !canChooseTrial ? <p className="text-caption text-[var(--color-secondary)]">{t(`trial_reason_${eligibility.reason}`)}</p> : null}
      {wantsTrial && eligibility?.reason === "PHONE_REQUIRED" ? (
        <PhoneVerificationCard onStatusChange={(phone) => { if (phone.verified) onPhoneVerified(); }} />
      ) : null}
    </div>
  );
}
