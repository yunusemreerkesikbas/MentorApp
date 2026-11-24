import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { MentorshipDataScopeKey, MentorshipSharedDataDto } from "@mentor/types";
import { formatScopeValue } from "../../../lib/mentorship-view.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { PanelCard, PanelCardTitle } from "../../panel/primitives.js";
import { AppText, Button, ConfirmDialog } from "../../ui/index.js";

export function MyCoachSharedDataCard({
  scope,
  values,
  busy,
  onEndLink,
}: {
  scope: MentorshipDataScopeKey[];
  values: MentorshipSharedDataDto | null;
  busy: boolean;
  onEndLink: () => void;
}) {
  const t = useTranslations("students");
  const { locale } = useLocale();
  const { palette, radii, space } = useThemeTokens();
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);

  const scopeLabels = {
    activityValue: (args: {
      days: number;
      sessions: number;
      minutes: number;
      activeDays: number;
      streak: number;
    }) => t("scope_value_ACTIVITY", args),
    mockExamsValue: (args: { count: number; date: string }) =>
      t("scope_value_MOCK_EXAMS", args),
    planTitlesValue: (args: { count: number; days: number }) =>
      t("scope_value_PLAN_TASK_TITLES", args),
    planRateValue: (args: { percent: number }) => t("scope_value_PLAN_RATE", args),
    moodValue: (args: { count: number; days: number; average: string }) =>
      t("scope_value_MOOD_LEVEL", args),
  };

  return (
    <PanelCard style={{ gap: space.md }}>
      <PanelCardTitle>{t("data_scope_title")}</PanelCardTitle>

      <View style={{ gap: space.sm }}>
        {scope.map((key) => {
          const liveValue = values
            ? formatScopeValue(key, values, scopeLabels, locale)
            : null;
          return (
            <View
              key={key}
              style={[
                styles.scopeRow,
                {
                  borderColor: palette.playLine,
                  backgroundColor: palette.surfaceAlt,
                  borderRadius: radii.inner,
                },
              ]}
            >
              <AppText variant="cardTitle">
                {t(`scope_short_${key}` as "scope_short_ACTIVITY")}
              </AppText>
              <AppText variant="caption" tone="secondary">
                {t(`scope_${key}` as "scope_ACTIVITY")}
              </AppText>
              {liveValue ? (
                <AppText variant="caption" tone="coach" tabularNums>
                  {liveValue}
                </AppText>
              ) : null}
            </View>
          );
        })}
      </View>

      <View
        style={[
          styles.trustBox,
          { backgroundColor: palette.coachAccentSoft, borderRadius: radii.inner },
        ]}
      >
        <AppText variant="caption" tone="coach">
          {t("privacy_trust_notice")}
        </AppText>
      </View>

      <Button
        label={t("end_my_coach_cta")}
        variant="danger"
        loading={busy}
        onPress={() => setConfirmEndOpen(true)}
      />

      <ConfirmDialog
        visible={confirmEndOpen}
        title={t("my_coach_end_confirm_title")}
        message={t("my_coach_end_confirm_body")}
        confirmLabel={t("my_coach_end_confirm_action")}
        cancelLabel={t("cancel_preview_cta")}
        destructive
        onCancel={() => setConfirmEndOpen(false)}
        onConfirm={() => {
          setConfirmEndOpen(false);
          onEndLink();
        }}
      />
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  scopeRow: {
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  trustBox: {
    padding: 12,
  },
});
