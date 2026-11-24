import { Share, StyleSheet, View, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { MentorshipStackBar } from "../../components/mentorship/coach-identity-badges.js";
import { PanelCard, PanelCardTitle } from "../../components/panel/primitives.js";
import { AppText, Button, Chip, Skeleton, StateView } from "../../components/ui/index.js";
import { formatDisplayDate } from "../../lib/display-date.js";
import { haptics } from "../../lib/haptics.js";
import { extractMentorshipError, formatWeeklyReportShareText } from "../../lib/mentorship-view.js";
import { fetchMyWeeklyReport, formatWeeklyMetric } from "../../lib/mentorship-weekly-reports-api.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

export default function MyCoachWeeklyReportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { palette, radii, space } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const params = useLocalSearchParams<{ reportId?: string | string[] }>();
  const reportId = Array.isArray(params.reportId) ? params.reportId[0] : params.reportId;

  const reportQuery = useQuery({
    queryKey: ["my-coach", "weekly-report", reportId],
    queryFn: () => fetchMyWeeklyReport(reportId!),
    enabled: Boolean(reportId),
  });

  const report = reportQuery.data ?? null;

  async function handleShare() {
    if (!report) return;
    void haptics.selection();
    const message = formatWeeklyReportShareText(
      report,
      {
        header: (args) => t("weekly_share_header", args),
        focusLine: (args) => t("weekly_share_focus", args),
        activeDaysLine: (args) => t("weekly_share_active_days", args),
        tasksLine: (args) => t("weekly_share_tasks", args),
        mockLine: (args) => t("weekly_share_mock", args),
        evaluationHeading: t("weekly_report_share_title"),
      },
      locale,
    );
    try {
      await Share.share({ message });
    } catch {
      // User dismissed share sheet
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <MentorshipStackBar title={t("weekly_report_title")} onBack={() => router.back()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: insets.bottom + space.xl,
          gap: space.md,
        }}
      >
        {!reportId || reportQuery.isError ? (
          <StateView
            title={tCommon("error_title")}
            body={extractMentorshipError(reportQuery.error, tCommon("error_body"))}
            actionLabel={tCommon("retry")}
            onAction={() => void reportQuery.refetch()}
            tone="error"
          />
        ) : reportQuery.isLoading || !report ? (
          <View style={{ gap: space.md }}>
            <Skeleton height={120} />
            <Skeleton height={180} />
          </View>
        ) : (
          <>
            <PanelCard style={{ gap: space.sm }}>
              <View style={styles.topRow}>
                <Chip label={t("weekly_report_status_finalized")} tone="coach" />
                <AppText variant="caption" tone="secondary">
                  v{report.version}
                </AppText>
              </View>
              <AppText variant="title">
                {`${formatDisplayDate(`${report.period.startDate}T12:00:00.000Z`, locale)} - ${formatDisplayDate(`${report.period.endDate}T12:00:00.000Z`, locale)}`}
              </AppText>
              <AppText variant="caption" tone="secondary">
                {t("my_weekly_report_row_meta", {
                  name: report.coachDisplayName,
                  date: formatDisplayDate(report.finalizedAt, locale),
                })}
              </AppText>
              <Button label={t("weekly_share_cta")} variant="secondary" onPress={() => void handleShare()} />
            </PanelCard>

            <PanelCard style={{ gap: space.sm }}>
              <PanelCardTitle>{t("weekly_panel_summary")}</PanelCardTitle>
              <MetricCompareRow
                label={t("weekly_report_focus")}
                current={formatWeeklyMetric("FOCUS_MINUTES", report.snapshot.current.focusMinutes, locale)}
                previous={formatWeeklyMetric("FOCUS_MINUTES", report.snapshot.previous.focusMinutes, locale)}
              />
              <MetricCompareRow
                label={t("weekly_report_active_days")}
                current={formatWeeklyMetric("ACTIVE_DAYS", report.snapshot.current.activeDays, locale)}
                previous={formatWeeklyMetric("ACTIVE_DAYS", report.snapshot.previous.activeDays, locale)}
              />
              <MetricCompareRow
                label={t("weekly_panel_tasks_done")}
                current={`${report.snapshot.current.completedTasks}/${report.snapshot.current.plannedTasks}`}
                previous={`${report.snapshot.previous.completedTasks}/${report.snapshot.previous.plannedTasks}`}
              />
              {report.snapshot.mocks.currentAttemptCount > 0 ||
              report.snapshot.mocks.previousAttemptCount > 0 ? (
                <MetricCompareRow
                  label={t("weekly_report_mock_average")}
                  current={formatWeeklyMetric("MOCK_AVERAGE", report.snapshot.mocks.currentAverageNet, locale)}
                  previous={formatWeeklyMetric("MOCK_AVERAGE", report.snapshot.mocks.previousAverageNet, locale)}
                />
              ) : null}
            </PanelCard>

            {report.snapshot.subjects.length > 0 ? (
              <PanelCard style={{ gap: space.sm }}>
                <PanelCardTitle>{t("weekly_panel_subjects")}</PanelCardTitle>
                {report.snapshot.subjects.map((sub, idx) => (
                  <MetricCompareRow
                    key={`${sub.subjectRef ?? "none"}-${idx}`}
                    label={
                      sub.subjectRef
                        ? (report.subjectNames[sub.subjectRef] ?? sub.subjectRef)
                        : t("weekly_report_unclassified")
                    }
                    current={formatWeeklyMetric("FOCUS_MINUTES", sub.currentFocusMinutes, locale)}
                    previous={formatWeeklyMetric("FOCUS_MINUTES", sub.previousFocusMinutes, locale)}
                  />
                ))}
              </PanelCard>
            ) : null}

            {report.coachEvaluation ? (
              <PanelCard style={{ gap: space.xs }}>
                <PanelCardTitle>{t("weekly_report_share_title")}</PanelCardTitle>
                <View
                  style={{
                    backgroundColor: palette.coachAccentSoft,
                    borderRadius: radii.inner,
                    padding: 12,
                  }}
                >
                  <AppText variant="body">{report.coachEvaluation}</AppText>
                </View>
              </PanelCard>
            ) : null}

            {report.snapshot.limitations.length > 0 ? (
              <PanelCard style={{ gap: 6 }}>
                <PanelCardTitle>{t("weekly_limitations_title")}</PanelCardTitle>
                {report.snapshot.limitations.map((lim) => (
                  <AppText key={lim} variant="caption" tone="secondary">
                    • {t(`weekly_report_limitation_${lim}` as "weekly_report_limitation_NO_CURRENT_ACTIVITY")}
                  </AppText>
                ))}
              </PanelCard>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function MetricCompareRow({
  label,
  current,
  previous,
}: {
  label: string;
  current: string;
  previous: string;
}) {
  const { palette } = useThemeTokens();
  const t = useTranslations("students");
  return (
    <View style={[styles.metricRow, { borderTopColor: palette.playLine }]}>
      <AppText variant="body" style={{ flex: 1 }}>
        {label}
      </AppText>
      <View style={styles.metricNums}>
        <AppText variant="cardTitle" tabularNums>
          {current}
        </AppText>
        <AppText variant="micro" tone="secondary" tabularNums>
          {t("weekly_prev_inline", { value: previous })}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  metricNums: {
    alignItems: "flex-end",
    gap: 2,
  },
});
