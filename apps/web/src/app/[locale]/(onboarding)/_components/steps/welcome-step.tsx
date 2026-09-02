"use client";

import { useTranslations } from "next-intl";
import { OnboardingStepLayout } from "../onboarding-step-layout";

export function WelcomeStep({
  displayName,
  onContinue,
}: {
  displayName: string;
  onContinue: () => void;
}) {
  const t = useTranslations("onboarding.welcome");

  return (
    <OnboardingStepLayout
      step={null}
      mascot="encouraging"
      title={t("title", { name: displayName })}
      subtitle={t("subtitle")}
      primaryLabel={t("continue")}
      onPrimary={onContinue}
    />
  );
}
