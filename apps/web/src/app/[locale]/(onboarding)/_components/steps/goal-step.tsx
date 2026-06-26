"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ApiClientError,
  coachingControllerUpsertVision,
} from "@mentor/api-client";
import { TextField } from "@mentor/ui";
import { FormError } from "@/components/form";
import { OnboardingStepLayout } from "../onboarding-step-layout";

const GOAL_FORM_ID = "onboarding-goal-form";

export type GoalSummary = {
  goalTitle: string;
  targetCity: string | null;
};

export function GoalStep({
  onSaved,
  onSkip,
  onBack,
}: {
  onSaved: (summary: GoalSummary) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("onboarding.goal");
  const vision = useTranslations("vision");
  const [goalTitle, setGoalTitle] = useState("");
  const [targetCity, setTargetCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedGoal = goalTitle.trim();
  const canSave = trimmedGoal.length > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setError(null);
    setSaving(true);
    try {
      await coachingControllerUpsertVision({
        goalTitle: trimmedGoal,
        targetCity: targetCity.trim() || null,
        motivation: null,
      });
      onSaved({
        goalTitle: trimmedGoal,
        targetCity: targetCity.trim() || null,
      });
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.body.message : t("save_error"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingStepLayout
      step={2}
      mascot="proud"
      title={t("title")}
      subtitle={t("subtitle")}
      onBack={onBack}
      skipLabel={t("skip")}
      onSkip={onSkip}
      primaryLabel={t("save")}
      primaryFormId={GOAL_FORM_ID}
      primaryBusy={saving}
      primaryDisabled={!canSave}
    >
      <form
        id={GOAL_FORM_ID}
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <FormError message={error} />

        <div className="flex flex-col gap-2">
          <TextField
            label={vision("goal_label")}
            value={goalTitle}
            maxLength={120}
            disabled={saving}
            autoFocus
            required
            placeholder={vision("goal_placeholder")}
            onChange={(e) => setGoalTitle(e.target.value)}
          />
          <p
            className="text-xs leading-relaxed"
            style={{ color: "var(--color-secondary)", fontFamily: "var(--font-body)" }}
          >
            {t("hint")}
          </p>
        </div>

        <TextField
          label={vision("city_label")}
          value={targetCity}
          maxLength={80}
          disabled={saving}
          placeholder={vision("city_placeholder")}
          onChange={(e) => setTargetCity(e.target.value)}
        />
      </form>
    </OnboardingStepLayout>
  );
}
