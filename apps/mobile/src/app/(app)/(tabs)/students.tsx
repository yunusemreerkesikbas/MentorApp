import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { CoachOverviewHeader } from "../../../components/mentorship/coach-overview-header.js";
import { StudentReportPanel } from "../../../components/mentorship/student-report-panel.js";
import {
  AppText,
  Card,
  Chip,
  Skeleton,
  StateView,
} from "../../../components/ui/index.js";
import {
  fetchCoachRegistrationState,
  fetchCohortBrief,
  fetchMentorshipOverview,
  fetchRoster,
} from "../../../lib/mentorship-api.js";
import { haptics } from "../../../lib/haptics.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

export default function CoachStudentsScreen() {
  const t = useTranslations("students");
  const insets = useSafeAreaInsets();
  const { palette, space } = useThemeTokens();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null,
  );

  const overviewQuery = useQuery({
    queryKey: ["mentorship-overview"],
    queryFn: fetchMentorshipOverview,
  });

  const regStateQuery = useQuery({
    queryKey: ["mentorship-registration-state"],
    queryFn: fetchCoachRegistrationState,
  });

  const rosterQuery = useQuery({
    queryKey: ["mentorship-roster"],
    queryFn: () => fetchRoster("ACTIVE"),
  });

  const cohortBriefQuery = useQuery({
    queryKey: ["mentorship-cohort-brief"],
    queryFn: fetchCohortBrief,
  });

  const isLoading = overviewQuery.isLoading && rosterQuery.isLoading;
  const isRefreshing =
    overviewQuery.isRefetching ||
    rosterQuery.isRefetching ||
    cohortBriefQuery.isRefetching;

  const handleRefresh = () => {
    void Promise.all([
      overviewQuery.refetch(),
      regStateQuery.refetch(),
      rosterQuery.refetch(),
      cohortBriefQuery.refetch(),
    ]);
  };

  const students = rosterQuery.data ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingHorizontal: space.lg,
        paddingBottom: space.xl,
        gap: space.md,
      }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={palette.coachAccent}
        />
      }
    >
      <View style={{ gap: 4 }}>
        <AppText variant="caption" tone="coach">
          {t("badge")}
        </AppText>
        <AppText variant="title">{t("title")}</AppText>
        <AppText variant="body" tone="secondary">
          {t("subtitle")}
        </AppText>
      </View>

      {isLoading ? (
        <View style={{ gap: space.sm }}>
          <Skeleton height={110} />
          <Skeleton height={160} />
        </View>
      ) : (
        <>
          <CoachOverviewHeader
            overview={overviewQuery.data ?? null}
            registrationState={regStateQuery.data ?? null}
            cohortBrief={cohortBriefQuery.data ?? null}
          />

          {selectedStudentId ? (
            <StudentReportPanel
              studentId={selectedStudentId}
              onClose={() => setSelectedStudentId(null)}
            />
          ) : null}

          {students.length === 0 ? (
            <StateView
              title={t("empty_title")}
              body={t("empty_body")}
              tone="empty"
            />
          ) : (
            <View style={{ gap: space.sm }}>
              {students.map((row) => (
                <Card key={row.linkId} style={{ gap: space.xs }}>
                  <View style={styles.rowBetween}>
                    <View>
                      <AppText variant="cardTitle">
                        {row.studentDisplayName}
                      </AppText>
                      {row.studentUsername ? (
                        <AppText variant="caption" tone="secondary">
                          @{row.studentUsername}
                        </AppText>
                      ) : null}
                    </View>
                    <Chip
                      label={t("open_report_cta")}
                      selected={selectedStudentId === row.studentId}
                      onPress={() => {
                        void haptics.selection();
                        setSelectedStudentId(
                          selectedStudentId === row.studentId
                            ? null
                            : row.studentId,
                        );
                      }}
                    />
                  </View>

                  {row.riskFlags.length > 0 ? (
                    <View style={styles.flagRow}>
                      {row.riskFlags.map((flag) => (
                        <Chip
                          key={flag}
                          label={t(`flag_${flag}` as "flag_INACTIVE")}
                          selected={row.needsAttention}
                        />
                      ))}
                    </View>
                  ) : null}

                  {row.metrics ? (
                    <AppText variant="caption" tone="secondary" tabularNums>
                      {t("focus_7d", { minutes: row.metrics.focusMinutes7d })} ·{" "}
                      {t("streak_days", { days: row.metrics.currentStreak })}
                      {row.metrics.planCompletionRate7d !== null
                        ? ` · ${t("plan_completion_7d", {
                            percent: Math.round(
                              row.metrics.planCompletionRate7d * 100,
                            ),
                          })}`
                        : ""}
                      {row.metrics.latestMockNet !== null
                        ? ` · ${t("latest_mock_net", {
                            net: row.metrics.latestMockNet,
                          })}`
                        : ""}
                    </AppText>
                  ) : null}
                </Card>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  flagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
});
