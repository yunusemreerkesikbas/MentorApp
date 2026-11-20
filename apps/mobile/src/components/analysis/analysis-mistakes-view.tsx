import { Pressable, StyleSheet, View } from "react-native";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import { PlayIcon } from "@solar-icons/react-native/bold/play";
import { useQuery } from "@tanstack/react-query";
import type { CoachingAnalysisDto } from "@mentor/types";
import { fetchNotebookReviewSummary, type MistakeScope } from "../../lib/analysis-api.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { CompanionBubble } from "../panel/companion-bubble.js";
import { LedgeButton, PanelCard, PanelCardTitle, ProgressLine } from "../panel/primitives.js";
import { AppText } from "../ui/index.js";
import { AnalysisLink } from "./analysis-link.js";
import { AnalysisReviewHistory } from "./analysis-review-history.js";

export function AnalysisMistakesView({ examId, analysis, onOpen, onEntry }: {
  examId: string;
  analysis: CoachingAnalysisDto;
  onOpen: (scope: MistakeScope, reviewing: boolean) => void;
  onEntry: (entryId: string) => void;
}) {
  const t = useTranslations("analysisMistakes");
  const tAnalysis = useTranslations("analysis");
  const { space, palette, touchTargets } = useThemeTokens();
  const stats = analysis.notebookStats;
  const signals = analysis.notebookErrorSignals;
  const summary = useQuery({
    queryKey: ["notebook", "summary", examId],
    queryFn: () => fetchNotebookReviewSummary(examId, {}),
    enabled: stats.savedCount > 0,
  });
  const due = summary.data?.dueCount;
  const canReview = stats.savedCount > 0 && due !== 0;
  const notebookLabel = t("open_notebook");
  const label = canReview ? (due == null ? t("cta_review") : t(due === 1 ? "cta_review_one" : "cta_review_count", { count: due })) : notebookLabel;

  return (
    <>
      <PanelCard style={{ gap: space.md }}>
        <CompanionBubble mood="encouraging" text={signals.length ? analysis.notebookErrorMessage ?? t("why_bubble") : t("why_bubble_empty")} />
        <View style={{ gap: space.xs }}>
          <AppText variant="title" accessibilityRole="header">{t("why_title")}</AppText>
          <AppText variant="caption" tone="secondary">
            {signals.length ? t("why_caption", { days: stats.windowDays }) : t("why_caption_empty")}
          </AppText>
        </View>
        {signals.map((signal) => {
          const reason = tAnalysis(`error_${signal.errorType}`);
          return (
            <Pressable key={signal.errorType} accessibilityRole="button"
              onPress={() => onOpen({ errorType: signal.errorType }, true)}
              style={[styles.row, { gap: space.sm, minHeight: touchTargets.comfortable, borderTopWidth: StyleSheet.hairlineWidth, borderColor: palette.border }]}>
              <View style={{ flex: 1, gap: space.xs }}>
                <View style={styles.spread}>
                  <AppText variant="caption" style={styles.label}>{reason}</AppText>
                  <AppText variant="micro" tone="secondary" tabularNums>{t("share", { count: signal.count, percent: signal.sharePercent })}</AppText>
                </View>
                <ProgressLine label={reason} value={signal.sharePercent} max={100} />
              </View>
              <AltArrowRightIcon size={18} color={palette.secondary} />
            </Pressable>
          );
        })}
        <LedgeButton accessibilityLabel={label} onPress={() => onOpen({}, canReview)}>
          {(ink) => <>
            {canReview ? <PlayIcon size={18} color={ink} /> : null}
            <AppText variant="cardTitle" tone="ctaInk">{label}</AppText>
          </>}
        </LedgeButton>
        {canReview ? <AnalysisLink label={notebookLabel} onPress={() => onOpen({}, false)} style={{ alignSelf: "flex-end" }} /> : null}
      </PanelCard>
      {analysis.photoSubjectSignals.length ? (
        <PanelCard style={{ gap: space.md }}>
          <PanelCardTitle>{t("where_title")}</PanelCardTitle>
          <AppText variant="caption" tone="secondary">{t("where_caption")}</AppText>
          {analysis.photoSubjectSignals.map((subject) => (
            <View key={subject.subjectRef}>
              <Pressable accessibilityRole="button" onPress={() => onOpen({ subjectRef: subject.subjectRef }, true)}
                style={{ gap: space.xs, minHeight: touchTargets.min, justifyContent: "center" }}>
                <View style={styles.spread}>
                  <AppText variant="caption" style={styles.label}>{subject.subjectName}</AppText>
                  <AppText variant="micro" tone="secondary">{analysis.photoSubjectSignals.length === 1
                    ? t(subject.count === 1 ? "topic_count_one" : "topic_count", { count: subject.count })
                    : t("share", { count: subject.count, percent: subject.sharePercent })}</AppText>
                </View>
                <ProgressLine label={subject.subjectName} value={subject.sharePercent} max={100} />
              </Pressable>
              {analysis.photoTopicSignals.filter((topic) => topic.subjectRef === subject.subjectRef).map((topic) => (
                <Pressable key={topic.topicRef} accessibilityRole="button"
                  onPress={() => onOpen({ subjectRef: subject.subjectRef, topicRef: topic.topicRef }, true)}
                  style={[styles.row, { gap: space.xs, paddingLeft: space.md, minHeight: touchTargets.min }]}>
                  <AppText variant="caption" style={{ flex: 1 }}>{topic.topicName}</AppText>
                  <AppText variant="micro" tone="secondary">{t(topic.count === 1 ? "topic_count_one" : "topic_count", { count: topic.count })}</AppText>
                  <AltArrowRightIcon size={16} color={palette.secondary} />
                </Pressable>
              ))}
            </View>
          ))}
        </PanelCard>
      ) : null}
      {stats.savedCount ? (
        <PanelCard style={{ gap: space.md }}>
          <View style={styles.spread}>
            <PanelCardTitle>{t("funnel_title", { days: stats.windowDays })}</PanelCardTitle>
            <AppText variant="micro" tone="secondary">{t("funnel_caption")}</AppText>
          </View>
          {([
            ["funnel_saved", stats.savedCount],
            ["funnel_reviewed", stats.reviewedCount],
            ["funnel_healed", stats.healedCount],
          ] as const).map(([key, value]) => (
            <View key={key} style={{ gap: space.xs }}>
              <View style={styles.spread}>
                <AppText variant="caption" style={styles.label}>{t(key)}</AppText>
                <AppText variant="caption" tabularNums>{value}</AppText>
              </View>
              <ProgressLine label={t(key)} value={value} max={stats.savedCount} complete={key === "funnel_healed"} />
            </View>
          ))}
          {!stats.healedCount ? <AppText variant="caption" tone="secondary">{t("funnel_healed_none")}</AppText> : null}
        </PanelCard>
      ) : null}
      <AnalysisReviewHistory examId={examId} onEntry={onEntry} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  spread: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  label: { fontWeight: "800", flexShrink: 1 },
});
