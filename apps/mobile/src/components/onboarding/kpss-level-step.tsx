import { useState } from "react";
import { View } from "react-native";
import type { OnboardingAudience } from "@mentor/core";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import { EXAM_CATALOG, type AuthUser, type ExamVariant } from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { Button } from "../ui/index.js";
import { PlayError, PlayOptionRow, PlayStepLayout, PuhuBubble } from "../onboarding-play/index.js";

/** The web's `KpssLevelStep`: saves KPSS together with the chosen level. */
export function KpssLevelStep({
  user, audience, progress, onBack, onSaved,
}: {
  user: AuthUser;
  audience: OnboardingAudience;
  progress: { done: number; total: number } | null;
  onBack: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("play");
  const tOnboarding = useTranslations("onboarding");
  const { setUserFromServer } = useAuth();
  const { space } = useThemeTokens();
  const [selected, setSelected] = useState<ExamVariant | null>(user.examType === "KPSS" ? user.examVariant : null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const updated = (await usersControllerUpdateMe({ examType: "KPSS", examVariant: selected })) as unknown as AuthUser;
      setUserFromServer(updated);
      haptics.success();
      onSaved();
    } catch (err) {
      haptics.error();
      setErrorMessage(err instanceof ApiClientError ? err.body.message : t("kpss_level_save_error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlayStepLayout
      progress={progress}
      onBack={onBack}
      busy={saving}
      heading={<PuhuBubble title={audience === "coach" ? t("kpss_level_title_coach") : t("kpss_level_title")} />}
      footer={
        <>
          <PlayError message={errorMessage} />
          <Button label={t("kpss_level_continue")} disabled={!selected} loading={saving} onPress={() => void handleSave()} />
        </>
      }
    >
      <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
        {EXAM_CATALOG.KPSS.variants.map((variant) => (
          <PlayOptionRow
            key={variant}
            label={tOnboarding(`kpss_variant_${variant}`)}
            selected={selected === variant}
            disabled={saving}
            onSelect={() => setSelected(variant)}
          />
        ))}
      </View>
    </PlayStepLayout>
  );
}
