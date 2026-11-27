import { useState } from "react";
import { View } from "react-native";
import { BackpackIcon } from "@solar-icons/react-native/linear/backpack";
import { Buildings2Icon } from "@solar-icons/react-native/linear/buildings-2";
import { SquareAcademicCapIcon } from "@solar-icons/react-native/linear/square-academic-cap";
import type { OnboardingAudience } from "@mentor/core";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import { EXAM_CATALOG, EXAM_TYPES, type AuthUser, type ExamType } from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { Button } from "../ui/index.js";
import { PlayError, PlayIconWell, PlayOptionRow, PlayStepLayout, PuhuBubble, type PlayWell } from "../onboarding-play/index.js";

const EXAM_LOOK: Record<ExamType, { well: PlayWell; Icon: typeof BackpackIcon }> = {
  KPSS: { well: "blue", Icon: Buildings2Icon },
  LGS: { well: "coral", Icon: BackpackIcon },
  YKS: { well: "peri", Icon: SquareAcademicCapIcon },
  ALES: { well: "peri", Icon: SquareAcademicCapIcon },
  DGS: { well: "peri", Icon: SquareAcademicCapIcon },
};

/** The web's `ExamStep`. An exam with levels moves on unsaved; the level step saves both. */
export function ExamStep({
  user, audience, progress, onBack, onSaved,
}: {
  user: AuthUser;
  audience: OnboardingAudience;
  progress: { done: number; total: number } | null;
  onBack: () => void;
  onSaved: (selected: ExamType) => void;
}) {
  const t = useTranslations("play");
  const { setUserFromServer } = useAuth();
  const { palette, space } = useThemeTokens();
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
      const updated = (await usersControllerUpdateMe({ examType: selected, examVariant: null })) as unknown as AuthUser;
      setUserFromServer(updated);
      haptics.success();
      onSaved(selected);
    } catch (err) {
      haptics.error();
      setErrorMessage(err instanceof ApiClientError ? err.body.message : t("exam_save_error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlayStepLayout
      progress={progress}
      onBack={onBack}
      busy={saving}
      heading={<PuhuBubble title={audience === "coach" ? t("exam_title_coach") : t("exam_title")} />}
      footer={
        <>
          <PlayError message={errorMessage} />
          <Button label={t("exam_continue")} disabled={!selected} loading={saving} onPress={() => void handleSave()} />
        </>
      }
    >
      <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
        {EXAM_TYPES.map((exam) => {
          const { well, Icon } = EXAM_LOOK[exam];
          return (
            <PlayOptionRow
              key={exam}
              label={exam}
              sub={t(`exam_options_${exam}`)}
              lead={<PlayIconWell well={well}><Icon size={22} color={palette.main} /></PlayIconWell>}
              selected={selected === exam}
              disabled={saving}
              onSelect={() => setSelected(exam)}
            />
          );
        })}
      </View>
    </PlayStepLayout>
  );
}
