import { StyleSheet, View } from "react-native";
import type { MentorshipWeeklyReportPreviewDto } from "@mentor/types";
import { MENTORSHIP_COACH_CONTEXT_MAX_LENGTH } from "@mentor/validation";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { PanelCard, PanelCardTitle } from "../../panel/primitives.js";
import { AppText, Button, TextField } from "../../ui/index.js";

export function CoachStudentWeeklyBriefCard({
  preview,
  coachContext,
  onContextChange,
  busy,
  onGenerate,
}: {
  preview: MentorshipWeeklyReportPreviewDto;
  coachContext: string;
  onContextChange: (value: string) => void;
  busy: boolean;
  onGenerate: () => void;
}) {
  const t = useTranslations("students");
  const { palette, radii, space } = useThemeTokens();
  const pending = preview.status === "BRIEF_PENDING";
  const prep = preview.brief?.preparation;

  return (
    <PanelCard style={{ gap: space.sm }}>
      <PanelCardTitle>{t("weekly_report_ai_title")}</PanelCardTitle>
      <AppText variant="caption" tone="secondary">
        {t("weekly_report_ai_body")}
      </AppText>

      <TextField
        label={t("preparation_context_label")}
        hint={t("preparation_context_hint", { count: coachContext.length })}
        placeholder={t("preparation_context_placeholder")}
        value={coachContext}
        onChangeText={onContextChange}
        maxLength={MENTORSHIP_COACH_CONTEXT_MAX_LENGTH}
        editable={!busy && !pending}
        multiline
        style={{ minHeight: 72, paddingTop: 10, textAlignVertical: "top" }}
      />

      <Button
        label={preview.brief ? t("weekly_report_ai_refresh") : t("weekly_report_ai_generate")}
        variant="secondary"
        loading={busy || pending}
        disabled={pending}
        onPress={onGenerate}
      />

      {pending ? (
        <AppText variant="caption" tone="coach">
          {t("weekly_report_ai_pending")}
        </AppText>
      ) : preview.status === "BRIEF_FAILED" ? (
        <AppText variant="caption" tone="danger">
          {t("weekly_report_ai_failed")}
        </AppText>
      ) : prep ? (
        <View
          style={[
            styles.prepBox,
            { backgroundColor: palette.surfaceAlt, borderRadius: radii.inner },
          ]}
        >
          <View style={{ gap: 2 }}>
            <AppText variant="caption" tone="coach">
              {t("preparation_focus")}
            </AppText>
            <AppText variant="body">{prep.focus.text}</AppText>
          </View>
          <View style={{ gap: 2 }}>
            <AppText variant="caption" tone="coach">
              {t("preparation_progress")}
            </AppText>
            <AppText variant="body">
              {prep.progress?.text ?? t("preparation_no_progress")}
            </AppText>
          </View>
          <View style={{ gap: 2 }}>
            <AppText variant="caption" tone="coach">
              {t("preparation_question")}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {prep.uncertainty}
            </AppText>
            <AppText variant="body">{prep.question}</AppText>
          </View>
          <View style={{ gap: 2 }}>
            <AppText variant="caption" tone="coach">
              {t("preparation_next_step")}
            </AppText>
            <AppText variant="body">{prep.nextStep ?? t("preparation_no_next_step")}</AppText>
          </View>
        </View>
      ) : preview.brief ? (
        <View style={{ gap: space.xs }}>
          {preview.brief.findings.map((finding, idx) => (
            <View
              key={idx}
              style={[
                styles.prepBox,
                { backgroundColor: palette.surfaceAlt, borderRadius: radii.inner },
              ]}
            >
              <AppText variant="body">{finding.observation}</AppText>
              <AppText variant="caption" tone="coach">
                {finding.conversationQuestion}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  prepBox: {
    padding: 12,
    gap: 10,
  },
});
