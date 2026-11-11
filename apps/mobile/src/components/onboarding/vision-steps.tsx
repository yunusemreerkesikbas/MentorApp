import { useState } from "react";
import { View } from "react-native";
import {
  ONBOARDING_MOTIVATION_KEYS,
  type OnboardingMotivationKey,
} from "@mentor/core";
import {
  ApiClientError,
  coachingControllerGetVision,
  coachingControllerUpsertVision,
} from "@mentor/api-client";
import {
  CAREER_GROUPS,
  type CareerGroup,
  type ExamType,
  type VisionDto,
} from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { OnboardingStepShell, PlayOptionCard } from "./step-shell.js";

export async function saveOnboardingVision(
  input: {
    goalTitle: string;
    careerGroup: CareerGroup | null;
    motivation: string | null;
  },
  replaceOwn: boolean,
): Promise<boolean> {
  if (!replaceOwn) {
    const response = await coachingControllerGetVision();
    const existing = ((response as { data?: VisionDto | null })?.data ??
      response) as VisionDto | null;
    if (existing?.goalTitle) return false;
  }
  await coachingControllerUpsertVision({ ...input, targetCity: null });
  return true;
}

export function WhyStep({
  progress,
  initial,
  onBack,
  onContinue,
}: {
  progress: { done: number; total: number } | null;
  initial: OnboardingMotivationKey | null;
  onBack: () => void;
  onContinue: (motivation: OnboardingMotivationKey | null) => void;
}) {
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const { space } = useThemeTokens();
  const [selected, setSelected] = useState<OnboardingMotivationKey | null>(
    initial,
  );

  const headingTitle = selected
    ? t(`why_reaction_${selected}`)
    : t("why_title");

  return (
    <OnboardingStepShell
      title={headingTitle}
      subtitle={t("why_subtitle")}
      progress={progress}
      onBack={onBack}
      skipLabel={tCommon("skip")}
      onSkip={() => onContinue(null)}
      primaryLabel={tCommon("continue")}
      primaryDisabled={!selected}
      onPrimary={() => {
        if (!selected) return;
        haptics.selection();
        onContinue(selected);
      }}
    >
      <View style={{ gap: space.sm }}>
        {ONBOARDING_MOTIVATION_KEYS.map((key) => (
          <PlayOptionCard
            key={key}
            label={t(`why_option_${key}`)}
            selected={selected === key}
            onPress={() => setSelected(key)}
          />
        ))}
      </View>
    </OnboardingStepShell>
  );
}

type FieldChoice = CareerGroup | "none";

export function FieldStep({
  progress,
  examType,
  motivation,
  initial,
  replaceOwnVision,
  onBack,
  onSaved,
}: {
  progress: { done: number; total: number } | null;
  examType: ExamType | null;
  motivation: OnboardingMotivationKey | null;
  initial: CareerGroup | null;
  replaceOwnVision: boolean;
  onBack: () => void;
  onSaved: (careerGroup: CareerGroup | null, wroteVision: boolean) => void;
}) {
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const { space } = useThemeTokens();
  const [selected, setSelected] = useState<FieldChoice | null>(initial);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLeave = async (choice: FieldChoice | null) => {
    if (saving) return;
    const careerGroup = choice && choice !== "none" ? choice : null;
    const motivationText =
      motivation && motivation !== "other"
        ? t(`why_option_${motivation}`)
        : null;

    if (!careerGroup && !motivationText) {
      onSaved(null, false);
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const wrote = await saveOnboardingVision(
        {
          goalTitle: careerGroup
            ? t("goal_title_field", { field: t(`field_group_${careerGroup}`) })
            : t("goal_title_exam", { exam: examType ?? "" }),
          careerGroup,
          motivation: motivationText,
        },
        replaceOwnVision,
      );
      haptics.success();
      onSaved(careerGroup, wrote);
    } catch (err) {
      haptics.error();
      setErrorMessage(
        err instanceof ApiClientError ? err.body.message : t("save_error"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingStepShell
      title={t("field_title")}
      subtitle={t("field_subtitle")}
      progress={progress}
      onBack={onBack}
      skipLabel={tCommon("skip")}
      onSkip={() => {
        void handleLeave(null);
      }}
      errorMessage={errorMessage}
      primaryLabel={tCommon("continue")}
      primaryDisabled={!selected}
      primaryLoading={saving}
      onPrimary={() => {
        void handleLeave(selected);
      }}
    >
      <View style={{ gap: space.sm }}>
        {CAREER_GROUPS.map((group) => (
          <PlayOptionCard
            key={group}
            label={t(`field_group_${group}`)}
            selected={selected === group}
            disabled={saving}
            onPress={() => setSelected(group)}
          />
        ))}
        <PlayOptionCard
          label={t("field_none")}
          selected={selected === "none"}
          disabled={saving}
          onPress={() => setSelected("none")}
        />
      </View>
    </OnboardingStepShell>
  );
}
