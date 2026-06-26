"use client";

import { useTranslations } from "next-intl";
import type { ExamType } from "@mentor/types";
import { Chip } from "@mentor/ui";
import { useRouter } from "@/i18n/navigation";
import { OnboardingStepLayout } from "../onboarding-step-layout";
import type { GoalSummary } from "./goal-step";

export function CompleteStep({
  examType,
  goal,
  onFinish,
  onBack,
}: {
  examType: ExamType;
  goal: GoalSummary | null;
  onFinish: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("onboarding.complete");
  const router = useRouter();

  function handleGoPanel() {
    onFinish();
    router.push("/panel");
  }

  return (
    <OnboardingStepLayout
      step={3}
      layout="centered"
      mascot="happy"
      title={t("title")}
      subtitle={t("subtitle")}
      onBack={onBack}
      primaryLabel={t("go_panel")}
      onPrimary={handleGoPanel}
    >
      <div className="flex flex-wrap gap-2">
        <Chip>{examType}</Chip>
        {goal ? (
          <>
            <Chip>{goal.goalTitle}</Chip>
            {goal.targetCity ? <Chip>{goal.targetCity}</Chip> : null}
          </>
        ) : null}
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "var(--color-secondary)" }}>
        {t("countdown_teaser")}
      </p>
    </OnboardingStepLayout>
  );
}
