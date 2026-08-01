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
    router.push("/dashboard");
  }

  /**
   * The goal map lives on the panel, not in onboarding — it would put ~60KB and an 81-way decision
   * in front of a user who hasn't seen the product yet. This is its discovery path: without it the
   * map is a feature nobody stumbles into.
   */
  function handleGoMap() {
    onFinish();
    router.push("/vision-board");
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
      <button
        type="button"
        onClick={handleGoMap}
        className="w-fit cursor-pointer text-sm font-semibold underline transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
        style={{ color: "var(--color-main)" }}
      >
        {t("map_cta")}
      </button>
    </OnboardingStepLayout>
  );
}
