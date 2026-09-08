"use client";

import { useTranslations } from "next-intl";
import { DashProgress } from "@/components/dash-progress";
import { onboardingTotalSteps } from "./onboarding-flow";

/**
 * Both branches happen to be the same length, so the bar takes no audience: the coach's last step
 * (their profile) sits exactly where the student's goal question does.
 *
 * Derived rather than hardcoded so the two cannot silently disagree — `onboarding-flow.spec.ts`
 * asserts the lengths match, and the day one branch grows a step, that assertion fails and this is
 * where the audience has to start being threaded through.
 */
const TOTAL = onboardingTotalSteps();

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
