import { useState } from "react";
import { View } from "react-native";
import {
  firstName,
  NET_PENALTY_DIVISOR,
  type OnboardingAudience,
} from "@mentor/core";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import {
  EXAM_CATALOG,
  EXAM_TYPES,
  type AuthUser,
  type ExamType,
  type ExamVariant,
} from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { OnboardingStepShell, PlayOptionCard } from "./step-shell.js";

export function IntroStep({
  displayName,
  onContinue,
}: {
  displayName: string;
  onContinue: () => void;
}) {
  const t = useTranslations("onboarding");
  const tDashboard = useTranslations("dashboard");
  const name = firstName(displayName) || tDashboard("default_name");

  return (
    <OnboardingStepShell
      title={t("intro_title", { name })}
      subtitle={t("intro_subtitle")}
      progress={null}
      primaryLabel={t("intro_cta")}
      onPrimary={() => {
        haptics.selection();
        onContinue();
      }}
    >
      <View />
    </OnboardingStepShell>
  );
}

export function ExamStep({
  user,
  audience,
  progress,
  onBack,
  onSaved,
}: {
  user: AuthUser;
  audience: OnboardingAudience;
  progress: { done: number; total: number } | null;
  onBack: () => void;
  onSaved: (selected: ExamType) => void;
}) {
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const { setUserFromServer } = useAuth();
  const { space } = useThemeTokens();
  const [selected, setSelected] = useState<ExamType | null>(user.examType);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async () => {
    if (!selected || saving) return;
    if (EXAM_CATALOG[selected].variants.length > 0) {
      haptics.selection();
      onSaved(selected);
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const updated = (await usersControllerUpdateMe({
        examType: selected,
        examVariant: null,
      })) as unknown as AuthUser;
      setUserFromServer(updated);
      haptics.success();
      onSaved(selected);
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
      title={audience === "coach" ? t("title_coach") : t("title")}
      subtitle={t("subtitle")}
      progress={progress}
      onBack={onBack}
      errorMessage={errorMessage}
      primaryLabel={tCommon("continue")}
      primaryDisabled={!selected}
      primaryLoading={saving}
      onPrimary={() => {
        void handleSave();
      }}
    >
      <View style={{ gap: space.sm }}>
        {EXAM_TYPES.map((exam) => {
          const divisor = NET_PENALTY_DIVISOR[exam];
          return (
            <PlayOptionCard
              key={exam}
              label={exam}
              subtitle={`${t(`exam_desc_${exam}`)} · Net: D - Y/${divisor}`}
              selected={selected === exam}
              disabled={saving}
              onPress={() => setSelected(exam)}
            />
          );
        })}
      </View>
    </OnboardingStepShell>
  );
}

export function KpssLevelStep({
  user,
  audience,
  progress,
  onBack,
  onSaved,
}: {
  user: AuthUser;
  audience: OnboardingAudience;
  progress: { done: number; total: number } | null;
  onBack: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const { setUserFromServer } = useAuth();
  const { space } = useThemeTokens();
  const [selected, setSelected] = useState<ExamVariant | null>(
    user.examType === "KPSS" ? user.examVariant : null,
  );
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const updated = (await usersControllerUpdateMe({
        examType: "KPSS",
        examVariant: selected,
      })) as unknown as AuthUser;
      setUserFromServer(updated);
      haptics.success();
      onSaved();
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
      title={audience === "coach" ? t("kpss_title_coach") : t("kpss_title")}
      progress={progress}
      onBack={onBack}
      errorMessage={errorMessage}
      primaryLabel={tCommon("continue")}
      primaryDisabled={!selected}
      primaryLoading={saving}
      onPrimary={() => {
        void handleSave();
      }}
    >
      <View style={{ gap: space.sm }}>
        {EXAM_CATALOG.KPSS.variants.map((variant) => (
          <PlayOptionCard
            key={variant}
            label={t(`kpss_variant_${variant}`)}
            selected={selected === variant}
            disabled={saving}
            onPress={() => setSelected(variant)}
          />
        ))}
      </View>
    </OnboardingStepShell>
  );
}
