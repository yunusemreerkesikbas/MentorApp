import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import type { CoachProfilePatchInput } from "@mentor/validation";
import { art } from "../../lib/art.js";
import { cardShadow } from "../../lib/layout.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Chip } from "../ui/index.js";

export type PreferenceChoices = Pick<
  CoachProfilePatchInput,
  "supportPreference" | "directnessPreference" | "memoryConsent"
>;

export function CoachCalibrationCard({ preferences, busy, error, onChoose, onSave, onSkip }: {
  preferences: PreferenceChoices;
  busy: boolean;
  error: string | null;
  onChoose: (choice: PreferenceChoices) => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  const t = useTranslations("coach");
  const { palette, radii, space, touchTargets } = useThemeTokens();
  const rows = [
    { label: t("calibration_support"), choices: [
      ["EMOTIONAL", t("calibration_emotional")], ["BALANCED", t("calibration_balanced")], ["ACTION", t("calibration_action")],
    ] as const, value: preferences.supportPreference, choose: (value: string) => onChoose({ supportPreference: value as PreferenceChoices["supportPreference"] }) },
    { label: t("calibration_directness"), choices: [
      ["GENTLE", t("directness_GENTLE")], ["BALANCED", t("directness_BALANCED")], ["DIRECT", t("directness_DIRECT")],
    ] as const, value: preferences.directnessPreference, choose: (value: string) => onChoose({ directnessPreference: value as PreferenceChoices["directnessPreference"] }) },
    { label: t("calibration_memory"), hint: t("calibration_memory_hint"), choices: [
      ["GRANTED", t("calibration_memory_yes")], ["DECLINED", t("calibration_memory_no")],
    ] as const, value: preferences.memoryConsent, choose: (value: string) => onChoose({ memoryConsent: value as PreferenceChoices["memoryConsent"] }) },
  ];

  return (
    <View style={[cardShadow, { backgroundColor: palette.surface, borderRadius: radii.card, padding: space.md, gap: space.sm }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Image source={art.puhuEncouraging} style={{ width: 44, height: 44 }} contentFit="contain" accessibilityIgnoresInvertColors />
        <View style={{ flex: 1, gap: space.xs }}>
          <AppText variant="cardTitle">{t("calibration_title")}</AppText>
          <AppText variant="micro" tone="secondary">{t("calibration_intro")}</AppText>
        </View>
      </View>
      {rows.map((row, index) => (
        <View key={row.label} style={{ gap: space.sm, paddingTop: space.sm, borderTopWidth: index ? 1 : 0, borderColor: palette.border }}>
          <AppText variant="caption">{row.label}</AppText>
          {row.hint ? <AppText variant="micro" tone="secondary">{row.hint}</AppText> : null}
          <View accessibilityLabel={row.label} style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {row.choices.map(([value, label]) => (
              <Chip key={value} label={label} selected={row.value === value}
                onPress={() => { if (!busy) row.choose(value); }}
                style={[cardShadow, { borderWidth: 0, backgroundColor: row.value === value ? palette.progress : palette.surface }]} />
            ))}
          </View>
        </View>
      ))}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Button label={t("calibration_save")} onPress={onSave} loading={busy}
          disabled={busy || !preferences.supportPreference || !preferences.directnessPreference || !preferences.memoryConsent || preferences.memoryConsent === "PENDING"} />
        <Pressable accessibilityRole="button" disabled={busy} onPress={onSkip} style={{ minHeight: touchTargets.min, justifyContent: "center", paddingHorizontal: space.sm }}>
          <AppText variant="caption" tone="secondary">{t("calibration_skip")}</AppText>
        </Pressable>
      </View>
      {error ? <AppText tone="danger" variant="caption" accessibilityLiveRegion="polite">{error}</AppText> : null}
    </View>
  );
}
