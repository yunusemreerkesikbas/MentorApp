import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { pickWeeklyVerdict } from "@mentor/core";
import type { WeeklyRecapReportDto } from "@mentor/types";
import { fetchWeeklyReportFollowUp } from "../../lib/coaching-api.js";
import { mixHex } from "../../lib/layout.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { CompanionBubble } from "../panel/companion-bubble.js";
import { PanelCard, PanelCardTitle } from "../panel/primitives.js";
import { Button } from "../ui/button.js";
import { AppText } from "../ui/text.js";
import { RecapAnalysisRhythm, RecapAnalysisSubjects } from "./recap-analysis-evidence.js";
import { RecapNextStep, RecapPreviousStep } from "./recap-analysis-follow-up.js";
import { recapPuhuNote } from "./recap-flow.js";
import { formatRecapRange } from "./recap-format.js";

export function RecapDeepAnalysis({ report, onStory, onExit, onPlan }: {
  report: WeeklyRecapReportDto;
  onStory: () => void;
  onExit: () => void;
  onPlan: (date: string) => void;
}) {
  const t = useTranslations("recapReport");
  const tCommon = useTranslations("common");
  const { locale } = useLocale();
  const { palette, space, touchTargets } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const followUp = useQuery({
    queryKey: ["weekly-report-follow-up", report.id],
    queryFn: () => fetchWeeklyReportFollowUp(report.id),
    staleTime: 0,
  });
  const { review } = report;
  const detail = review.deepAnalysis;
  const note = recapPuhuNote(review.recap.closingMessage, report.narration?.narration);
  const verdict = useVerdict(review);
  const period = formatRecapRange(report.weekStart, report.endDate, locale);
  const oldSummary = [review.rhythm.message, review.plan.message, review.performance?.message].filter(Boolean);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space.sm,
        paddingBottom: insets.bottom + space.xl,
        paddingHorizontal: space.lg,
        gap: space.lg,
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onExit}
        style={[styles.close, { minHeight: touchTargets.comfortable }]}
      >
        <AppText style={{ color: palette.accent, fontWeight: "800" }}>{tCommon("close")}</AppText>
      </Pressable>
      <PanelCard style={[styles.section, { backgroundColor: mixHex(palette.progress, palette.surface, 0.08) }]}>
        <AppText variant="caption" tone="secondary">
          {t("eyebrow", { range: `${period} ${report.endDate.slice(0, 4)}` })}
        </AppText>
        <AppText accessibilityRole="header" variant="title">{verdict}</AppText>
        {detail && review.recap.weeklyTitle ? (
          <AppText variant="caption" style={styles.nickname}>
            {t("nickname", { label: review.recap.weeklyTitle.label })}
          </AppText>
        ) : null}
        <CompanionBubble mood="happy" text={note.text} aiLabel={note.personalized ? t("ai_note") : null} />
        <Button variant="secondary" label={t("story")} onPress={onStory} />
      </PanelCard>

      <RecapNextStep report={report} followUp={followUp} onPlan={onPlan} />
      {detail ? <RecapAnalysisRhythm metrics={detail.metrics} /> : (
        <PanelCard style={styles.section}>
          <PanelCardTitle>{t("legacy_title")}</PanelCardTitle>
          {oldSummary.map((line, index) => <AppText key={index}>{line}</AppText>)}
          <AppText variant="caption" tone="secondary">{t("legacy_detail")}</AppText>
        </PanelCard>
      )}
      <RecapPreviousStep previous={followUp.data?.previous} onPlan={onPlan} />
      {detail ? <RecapAnalysisSubjects subjects={detail.subjects} /> : null}
      <View style={styles.footnote}>
        {detail?.evidenceMessage ? <AppText variant="caption" tone="secondary">{detail.evidenceMessage}</AppText> : null}
        <AppText variant="caption" tone="secondary">{t("footnote")}</AppText>
      </View>
    </ScrollView>
  );
}

function useVerdict(review: WeeklyRecapReportDto["review"]): string {
  const t = useTranslations("recapReport");
  const { locale } = useLocale();
  const fallback = review.recap.weeklyTitle?.message ?? review.recap.closingMessage;
  if (!review.deepAnalysis) return fallback;
  const { metric, subject } = pickWeeklyVerdict(review.deepAnalysis);
  const delta = subject
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2, signDisplay: "exceptZero" }).format(subject.delta)
    : "";
  if (!metric) return subject ? t("verdict_subject_only", { subject: subject.name, delta }) : fallback;
  const gain = t(`verdict_metric_${metric.id}`, { previous: metric.previous, current: metric.current });
  return subject ? t("verdict_with_subject", { metric: gain, subject: subject.name, delta }) : t("verdict_metric_only", { metric: gain });
}

const styles = StyleSheet.create({
  close: { alignSelf: "flex-start", justifyContent: "center" },
  section: { gap: 12 },
  nickname: { fontWeight: "800" },
  footnote: { gap: 6, paddingHorizontal: 4 },
});
