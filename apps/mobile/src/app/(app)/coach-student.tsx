import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MentorshipStackBar } from "../../components/mentorship/coach-identity-badges.js";
import { CoachStudentFollowupsTab } from "../../components/mentorship/coach/coach-student-followups-tab.js";
import { CoachStudentOverviewTab } from "../../components/mentorship/coach/coach-student-overview-tab.js";
import { CoachStudentPlanningTab } from "../../components/mentorship/coach/coach-student-planning-tab.js";
import { CoachStudentWeeklyTab } from "../../components/mentorship/coach/coach-student-weekly-tab.js";
import {
  AppText,
  Button,
  Chip,
  ConfirmDialog,
  Skeleton,
  SlidingTabs,
  StateView,
} from "../../components/ui/index.js";
import { haptics } from "../../lib/haptics.js";
import {
  endStudentLink,
  fetchStudentReport,
  setStudentAttention,
} from "../../lib/mentorship-api.js";
import { extractMentorshipError } from "../../lib/mentorship-view.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useToast } from "../../providers/toast-provider.js";

type DetailTab = "overview" | "planning" | "followups" | "weekly";

export default function CoachStudentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const params = useLocalSearchParams<{
    studentId?: string | string[];
    tab?: string | string[];
  }>();
  const studentId = Array.isArray(params.studentId)
    ? params.studentId[0]
    : params.studentId;
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const [tab, setTab] = useState<DetailTab>(
    rawTab === "planning" || rawTab === "followups" || rawTab === "weekly"
      ? rawTab
      : "overview",
  );
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);

  const reportQuery = useQuery({
    queryKey: ["mentorship-report", studentId],
    queryFn: () => fetchStudentReport(studentId!),
    enabled: Boolean(studentId),
  });

  const attentionMutation = useMutation({
    mutationFn: (attended: boolean) => setStudentAttention(studentId!, attended),
    onSuccess: () => {
      void haptics.selection();
      void queryClient.invalidateQueries({ queryKey: ["mentorship-report", studentId] });
      void queryClient.invalidateQueries({ queryKey: ["mentorship-roster", "ACTIVE"] });
    },
    onError: (err) => toast.show(extractMentorshipError(err, tCommon("error_body"))),
  });

  const endLinkMutation = useMutation({
    mutationFn: () => endStudentLink(studentId!),
    onSuccess: async () => {
      void haptics.success();
      await queryClient.invalidateQueries({ queryKey: ["mentorship-roster"] });
      await queryClient.invalidateQueries({ queryKey: ["mentorship-overview"] });
      router.back();
    },
    onError: (err) => toast.show(extractMentorshipError(err, tCommon("error_body"))),
  });

  const report = reportQuery.data ?? null;

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <MentorshipStackBar
        title={report?.studentDisplayName ?? t("student_detail_title")}
        onBack={() => router.back()}
      />
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: insets.bottom + space.xl,
          gap: space.md,
        }}
      >
        {!studentId || reportQuery.isError ? (
          <StateView
            title={tCommon("error_title")}
            body={extractMentorshipError(reportQuery.error, tCommon("error_body"))}
            actionLabel={tCommon("retry")}
            onAction={() => void reportQuery.refetch()}
            tone="error"
          />
        ) : reportQuery.isLoading || !report ? (
          <Skeleton height={220} />
        ) : (
          <>
            <View style={styles.metaBar}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="title">{report.studentDisplayName}</AppText>
                {report.studentUsername ? (
                  <AppText variant="caption" tone="secondary">
                    @{report.studentUsername}
                  </AppText>
                ) : null}
              </View>
              {report.studentExamType ? (
                <Chip label={report.studentExamType} tone="coach" />
              ) : null}
            </View>

            <View style={styles.quickActions}>
              {report.needsAttention || report.attendedAt ? (
                <Button
                  label={
                    report.needsAttention
                      ? t("mark_attended_cta")
                      : t("unmark_attended_cta")
                  }
                  variant="secondary"
                  loading={attentionMutation.isPending}
                  onPress={() => attentionMutation.mutate(report.needsAttention)}
                  style={{ flex: 1 }}
                />
              ) : null}
              <Button
                label={t("end_student_link_cta")}
                variant="danger"
                loading={endLinkMutation.isPending}
                onPress={() => setConfirmEndOpen(true)}
                style={{ flex: 1 }}
              />
            </View>

            <SlidingTabs
              compact
              items={[
                { id: "overview", label: t("detail_tab_overview") },
                { id: "planning", label: t("detail_tab_planning") },
                { id: "followups", label: t("detail_tab_followups") },
                { id: "weekly", label: t("detail_tab_weekly") },
              ]}
              value={tab}
              onChange={setTab}
              accessibilityLabel={t("detail_tabs_label")}
            />

            {tab === "overview" ? <CoachStudentOverviewTab report={report} /> : null}
            {tab === "planning" ? <CoachStudentPlanningTab report={report} /> : null}
            {tab === "followups" ? (
              <CoachStudentFollowupsTab studentId={report.studentId} />
            ) : null}
            {tab === "weekly" ? <CoachStudentWeeklyTab studentId={report.studentId} /> : null}
          </>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={confirmEndOpen}
        title={t("end_student_confirm_title")}
        message={t("end_student_confirm_body", {
          name: report?.studentDisplayName ?? "",
        })}
        confirmLabel={t("my_coach_end_confirm_action")}
        cancelLabel={t("cancel_preview_cta")}
        destructive
        onCancel={() => setConfirmEndOpen(false)}
        onConfirm={() => {
          setConfirmEndOpen(false);
          endLinkMutation.mutate();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  metaBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
