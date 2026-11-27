import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { CompassIcon } from "@solar-icons/react-native/linear/compass";
import type { OnboardingMotivationKey } from "@mentor/core";
import { ApiClientError } from "@mentor/api-client";
import { CAREER_GROUPS, type CareerGroup, type ExamType } from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import { careerPuhu3d } from "../../lib/onboarding-assets.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { Button } from "../ui/index.js";
import { PlayError, PlayGridCard, PlayIconWell, PlayStepLayout, PlayTitle } from "../onboarding-play/index.js";
import { gridRows } from "../../lib/grid-rows.js";
import { saveOnboardingVision } from "./onboarding-vision.js";

type FieldChoice = CareerGroup | "none";
const CHOICES: readonly FieldChoice[] = [...CAREER_GROUPS, "none"];
const ART = 52;

/**
 * The web's `FieldStep` on the soft-3D career Puhus. Leaving it (Devam or Şimdilik geç) writes the
 * why + field answers to the goal board in one go; with neither answered nothing is written.
 */
export function FieldStep({
  progress, examType, motivation, initial, replaceOwnVision, onBack, onSaved,
}: {
  progress: { done: number; total: number } | null;
  examType: ExamType | null;
  motivation: OnboardingMotivationKey | null;
  initial: CareerGroup | null;
  replaceOwnVision: boolean;
  onBack: () => void;
  onSaved: (careerGroup: CareerGroup | null, wroteVision: boolean) => void;
}) {
  const t = useTranslations("play");
  const tOnboarding = useTranslations("onboarding");
  const { palette, space, mode } = useThemeTokens();
  const [selected, setSelected] = useState<FieldChoice | null>(initial);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const leave = async (choice: FieldChoice | null) => {
    if (saving) return;
    const careerGroup = choice && choice !== "none" ? choice : null;
    const motivationText = motivation && motivation !== "other" ? t(`why_options_${motivation}`) : null;
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
            ? t("field_goal_title", { field: tOnboarding(`field_group_${careerGroup}`) })
            : t("field_goal_title_exam", { exam: examType ?? "" }),
          careerGroup,
          motivation: motivationText,
        },
        replaceOwnVision,
      );
      haptics.success();
      onSaved(careerGroup, wrote);
    } catch (err) {
      haptics.error();
      setErrorMessage(err instanceof ApiClientError ? err.body.message : t("field_save_error"));
    } finally {
      setSaving(false);
    }
  };

  // Dark theme: the art keeps its light studio backdrop on a rounded tile (web `dark:rounded-xl`).
  const artTile = mode === "dark" ? styles.darkTile : null;

  return (
    <PlayStepLayout
      progress={progress}
      onBack={onBack}
      busy={saving}
      skipLabel={t("field_skip")}
      onSkip={() => void leave(null)}
      heading={<PlayTitle center title={t("field_title")} sub={t("field_subtitle")} />}
      footer={
        <>
          <PlayError message={errorMessage} />
          <Button label={t("field_continue")} disabled={!selected} loading={saving} onPress={() => void leave(selected)} />
        </>
      }
    >
      <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
        {gridRows(CHOICES, 3).map((row) => (
          <View key={row[0]!} style={{ flexDirection: "row", gap: space.sm }}>
            {row.map((choice, index) => choice ? (
              <PlayGridCard
                key={choice}
                compact
                label={choice === "none" ? tOnboarding("field_none") : tOnboarding(`field_group_${choice}`)}
                art={choice === "none" ? (
                  <PlayIconWell well="peri" size={ART}><CompassIcon size={26} color={palette.main} /></PlayIconWell>
                ) : (
                  <Image source={careerPuhu3d(choice)} style={[styles.art, artTile]} contentFit="contain" accessible={false} />
                )}
                selected={selected === choice}
                disabled={saving}
                onSelect={() => setSelected(choice)}
              />
            ) : <View key={`pad-${index}`} style={styles.pad} />)}
          </View>
        ))}
      </View>
    </PlayStepLayout>
  );
}

const styles = StyleSheet.create({
  art: { width: ART, height: ART },
  darkTile: { borderRadius: 12, overflow: "hidden" },
  pad: { flex: 1 },
});
