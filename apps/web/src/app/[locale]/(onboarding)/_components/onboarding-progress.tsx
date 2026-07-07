"use client";

import { useTranslations } from "next-intl";
import { DashProgress } from "@/components/dash-progress";

const TOTAL = 5;

export function OnboardingProgress({ step }: { step: number }) {
  const t = useTranslations("onboarding");

  return (
    <DashProgress
      step={step}
      total={TOTAL}
      ariaLabel={t("progress_aria", { current: step + 1, total: TOTAL })}
    />
  );
}
