import { View } from "react-native";
import { formatTrendDate } from "@mentor/core";
import type { CoachingAnalysisDto, MockExamDto } from "@mentor/types";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { CompanionBubble } from "../panel/companion-bubble.js";
import { PanelCard, PanelCardTitle } from "../panel/primitives.js";
import { AppText, Button } from "../ui/index.js";
import { AnalysisLink } from "./analysis-link.js";

export function AnalysisSavedCard({ item, analysis, onProgress, onMistakes, onNew }: {
  item: MockExamDto;
  analysis?: CoachingAnalysisDto;
  onProgress: () => void;
  onMistakes: () => void;
  onNew: () => void;
}) {
  const { locale } = useLocale();
  const t = useTranslations("analysisEntry");
  const tAnalysis = useTranslations("analysis");
  const tNet = useTranslations("analysisNet");
  const { space } = useThemeTokens();
  const latest = analysis?.trend[0];
  const ghost = analysis?.ghost?.latest.id === item.id ? analysis.ghost : null;
  const message = ghost ? t("bubble_latest", { headline: ghost.headline })
    : latest && Date.parse(latest.takenAt) > Date.parse(item.takenAt) ? t("bubble_past") : t("bubble_saved");

  return (
    <PanelCard style={{ gap: space.md }}>
      <CompanionBubble mood="happy" text={message} />
      <PanelCardTitle>{t("title", { publisher: item.publisherName ?? item.examName, date: formatTrendDate(item.takenAt, locale) })}</PanelCardTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: space.sm }}>
        <AppText variant="display" tabularNums>{tAnalysis("net_suffix", { net: item.totalNet })}</AppText>
        {ghost ? (
          <AppText tone={Number(ghost.previousDelta) > 0 ? "success" : "secondary"} variant="caption">
            {ghost.previousDelta} {tNet("delta_caption")}
          </AppText>
        ) : null}
        {ghost?.isNewRecord ? <AppText variant="caption" tone="success">{tNet("new_record")}</AppText> : null}
      </View>
      {ghost?.subjects.length ? (
        <View style={{ gap: space.xs }}>
          <PanelCardTitle>{t("subjects_title")}</PanelCardTitle>
          {ghost.subjects.map((subject) => (
            <View key={subject.subjectRef} style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
              <AppText variant="caption" style={{ flex: 1 }}>{subject.subjectName}</AppText>
              <AppText variant="caption" tabularNums tone="secondary">{subject.delta ?? subject.latestNet}</AppText>
            </View>
          ))}
        </View>
      ) : null}
      <Button label={t("cta_notebook")} onPress={onMistakes} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: space.sm }}>
        <AnalysisLink label={t("cta_progress")} onPress={onProgress} />
        <AnalysisLink label={t("new_exam")} onPress={onNew} />
      </View>
    </PanelCard>
  );
}
