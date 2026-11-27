import { useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatNet } from "@mentor/core";
import { MENTORSHIP_COACH_NOTE_MAX } from "@mentor/validation";
import type {
  MentorshipBriefDto,
  MentorshipBriefHistoryItemDto,
  MentorshipStudentReportDto,
} from "@mentor/types";
import { formatDisplayDate } from "../../../lib/display-date.js";
import { haptics } from "../../../lib/haptics.js";
import {
  fetchBriefHistory,
  generateStudentBrief,
  setCoachNote,
} from "../../../lib/mentorship-api.js";
import { extractMentorshipError } from "../../../lib/mentorship-view.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { useToast } from "../../../providers/toast-provider.js";
import { PanelCard, PanelCardTitle } from "../../panel/primitives.js";
import { AppText, Button, Chip, TextField } from "../../ui/index.js";

export function CoachStudentOverviewTab({
  report,
}: {
  report: MentorshipStudentReportDto;
}) {
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const { locale } = useLocale();
  const compact = useWindowDimensions().width <= 480;
  const toast = useToast();
  const queryClient = useQueryClient();
  const { palette, radii, space } = useThemeTokens();

  const [noteDraft, setNoteDraft] = useState(report.coachNote?.body ?? "");
  const [brief, setBrief] = useState<MentorshipBriefDto | null>(null);
  const [history, setHistory] = useState<MentorshipBriefHistoryItemDto[] | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);

  const trimmed = noteDraft.trim();
  const nextNote = trimmed.length > 0 ? trimmed : null;
  const noteUnchanged = nextNote === (report.coachNote?.body ?? null);

  const noteMutation = useMutation({
    mutationFn: () => setCoachNote(report.studentId, nextNote),
    onSuccess: () => {
      void haptics.success();
      void queryClient.invalidateQueries({ queryKey: ["mentorship-report", report.studentId] });
      toast.show(nextNote === null ? t("note_cleared") : t("note_saved"));
    },
    onError: (err) => {
      void haptics.error();
      toast.show(extractMentorshipError(err, tCommon("error_body")));
    },
  });

  const briefMutation = useMutation({
    mutationFn: () => generateStudentBrief(report.studentId),
    onSuccess: (next) => {
      void haptics.success();
      setBrief(next);
    },
    onError: (err) => {
      void haptics.error();
      toast.show(extractMentorshipError(err, tCommon("error_body")));
    },
  });

  async function loadHistory() {
    setHistoryBusy(true);
    try {
      const page = await fetchBriefHistory(report.studentId, 1, 5);
      setHistory(page.items);
    } catch (err) {
      toast.show(extractMentorshipError(err, tCommon("error_body")));
    } finally {
      setHistoryBusy(false);
    }
  }

  const max28 = Math.max(15, ...report.dailyFocusMinutes28d);

  return (
    <View style={{ gap: space.md }}>
      {report.riskFlags.length > 0 ? (
        <View style={styles.chipWrap}>
          {report.riskFlags.map((flag) => (
            <Chip
              key={flag}
              label={t(`flag_${flag}` as "flag_INACTIVE")}
              tone={report.needsAttention ? "warning" : "default"}
            />
          ))}
        </View>
      ) : null}

      <PanelCard style={{ gap: space.sm }}>
        <PanelCardTitle>{t("report_activity_title")}</PanelCardTitle>
        <View style={styles.statGrid}>
          <StatTile
            label={t("report_7d_focus")}
            value={`${report.activity.focusMinutes7d} dk`}
          />
          <StatTile
            label={t("report_7d_sessions")}
            value={`${report.activity.sessions7d}`}
          />
          <StatTile
            label={t("report_streak_title")}
            value={`${report.activity.currentStreak} / ${report.activity.longestStreak}`}
          />
          <StatTile
            label={t("report_28d_focus")}
            value={`${report.activity.focusMinutes28d} dk`}
          />
        </View>
        <View style={styles.barRow}>
          {report.dailyFocusMinutes28d.map((mins, idx) => (
            <View
              key={idx}
              style={[
                styles.bar,
                {
                  height: mins > 0 ? Math.max(5, Math.round((mins / max28) * 32)) : 3,
                  backgroundColor: mins > 0 ? palette.coachAccent : palette.playTrack,
                  borderRadius: radii.pill,
                },
              ]}
            />
          ))}
        </View>
        <AppText variant="micro" tone="secondary">
          {t("report_28d_caption", { days: report.activity.activeDays28d })}
        </AppText>
      </PanelCard>

      {report.studentNote ? (
        <PanelCard style={{ gap: space.xs }}>
          <PanelCardTitle>{t("student_note_title")}</PanelCardTitle>
          <View
            style={[
              styles.quoteBox,
              { backgroundColor: palette.surfaceAlt, borderRadius: radii.inner },
            ]}
          >
            <AppText variant="body">{report.studentNote.body}</AppText>
            <AppText variant="micro" tone="secondary">
              {t("note_updated_on", {
                date: formatDisplayDate(report.studentNote.updatedAt, locale),
              })}
            </AppText>
          </View>
        </PanelCard>
      ) : null}

      <PanelCard style={{ gap: space.sm }}>
        <PanelCardTitle>{t("coach_note_label")}</PanelCardTitle>
        <TextField
          label={t("my_note_hint", {
            count: noteDraft.length,
            max: MENTORSHIP_COACH_NOTE_MAX,
          })}
          value={noteDraft}
          onChangeText={setNoteDraft}
          placeholder={t("coach_note_placeholder")}
          maxLength={MENTORSHIP_COACH_NOTE_MAX}
          multiline
          style={{ minHeight: 82, paddingTop: 10, textAlignVertical: "top" }}
        />
        <Button
          label={t("save_note_cta")}
          variant="secondary"
          disabled={noteUnchanged}
          loading={noteMutation.isPending}
          onPress={() => noteMutation.mutate()}
        />
      </PanelCard>

      <PanelCard style={{ gap: space.sm }}>
        <PanelCardTitle>{t("student_brief_title")}</PanelCardTitle>
        {brief ? (
          <View
            style={[
              styles.quoteBox,
              { backgroundColor: palette.surfaceAlt, borderRadius: radii.inner },
            ]}
          >
            <AppText variant="body">{brief.brief}</AppText>
            {brief.model === "cache" ? (
              <AppText variant="micro" tone="secondary">
                {t("brief_cache_note")}
              </AppText>
            ) : null}
          </View>
        ) : (
          <AppText variant="caption" tone="secondary">
            {t("student_brief_hint")}
          </AppText>
        )}
        <View style={[styles.briefActions, compact && styles.briefActionsCompact]}>
          <Button
            label={t("generate_student_brief_cta")}
            variant="secondary"
            loading={briefMutation.isPending}
            onPress={() => briefMutation.mutate()}
            style={compact ? undefined : styles.briefAction}
          />
          <Button
            label={t("brief_history_open")}
            variant="secondary"
            loading={historyBusy}
            onPress={() => void loadHistory()}
            style={compact ? undefined : styles.briefAction}
          />
        </View>
        {history ? (
          history.length === 0 ? (
            <AppText variant="caption" tone="secondary">
              {t("brief_history_empty")}
            </AppText>
          ) : (
            <View style={{ gap: space.xs }}>
              {history.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.quoteBox,
                    { backgroundColor: palette.surfaceAlt, borderRadius: radii.inner },
                  ]}
                >
                  <AppText variant="micro" tone="secondary">
                    {formatDisplayDate(item.generatedAt, locale)}
                  </AppText>
                  <AppText variant="caption">{item.brief}</AppText>
                </View>
              ))}
            </View>
          )
        ) : null}
      </PanelCard>

      <PanelCard style={{ gap: space.sm }}>
        <PanelCardTitle>{t("report_mocks_title")}</PanelCardTitle>
        {report.mockTrend.length === 0 ? (
          <AppText variant="caption" tone="secondary">
            {t("report_mocks_empty")}
          </AppText>
        ) : (
          <View style={{ gap: 6 }}>
            {report.mockTrend.slice(0, 5).map((mock, idx) => (
              <View key={idx} style={styles.lineBetween}>
                <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
                  {mock.examName ?? "-"} · {formatDisplayDate(mock.takenAt, locale)}
                </AppText>
                <AppText variant="cardTitle" tabularNums>
                  {formatNet(mock.totalNet, locale)}
                </AppText>
              </View>
            ))}
            {report.latestMockSubjects.length > 0 ? (
              <View style={{ gap: 4, paddingTop: 6 }}>
                <AppText variant="caption" tone="coach">
                  {t("report_latest_mock_subjects")}
                </AppText>
                {report.latestMockSubjects.map((sub) => (
                  <View key={sub.subjectRef} style={styles.lineBetween}>
                    <AppText variant="caption" style={{ flex: 1 }}>
                      {sub.subjectName}
                    </AppText>
                    <AppText variant="caption" tone="secondary" tabularNums>
                      {sub.correct}D / {sub.wrong}Y · {formatNet(sub.net, locale)} net
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </PanelCard>

      <PanelCard style={{ gap: space.sm }}>
        <PanelCardTitle>{t("report_plan_title")}</PanelCardTitle>
        <AppText variant="caption" tone="secondary" tabularNums>
          {report.planCompletionRate7d !== null
            ? t("plan_completion_7d", {
                percent: Math.round(report.planCompletionRate7d * 100),
              })
            : t("report_plan_empty")}
        </AppText>
        {report.planTasks.slice(0, 12).map((task, idx) => (
          <View key={idx} style={[styles.taskRow, { borderTopColor: palette.playLine }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="cardTitle">{task.title}</AppText>
              <AppText variant="micro" tone="secondary">
                {task.taskDate}
                {task.subject ? ` · ${task.subject}` : ""}
              </AppText>
              {task.coachNote ? (
                <AppText variant="micro" tone="coach">
                  {task.coachNote}
                </AppText>
              ) : null}
            </View>
            <Chip
              label={task.status === "DONE" ? t("task_done_badge") : t("task_pending_badge")}
              tone={task.status === "DONE" ? "success" : task.assignedByCoach ? "coach" : "default"}
            />
          </View>
        ))}
        {report.droppedAssignments.length > 0 ? (
          <View style={{ gap: 4, paddingTop: 6 }}>
            <AppText variant="caption" tone="warning">
              {t("report_dropped_title")}
            </AppText>
            {report.droppedAssignments.map((drop, idx) => (
              <AppText key={idx} variant="micro" tone="secondary">
                • {drop.taskDate}: {drop.title}
              </AppText>
            ))}
          </View>
        ) : null}
      </PanelCard>

      <PanelCard style={{ gap: space.xs }}>
        <PanelCardTitle>{t("report_mood_title")}</PanelCardTitle>
        {report.moodTrend.length === 0 ? (
          <AppText variant="caption" tone="secondary">
            {t("report_mood_empty")}
          </AppText>
        ) : (
          <View style={styles.chipWrap}>
            {report.moodTrend.slice(-7).map((entry) => (
              <Chip
                key={entry.date}
                label={`${entry.date.slice(5)}: ${entry.level}/5`}
              />
            ))}
          </View>
        )}
      </PanelCard>
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  const { palette, radii } = useThemeTokens();
  return (
    <View
      style={[
        styles.statTile,
        { backgroundColor: palette.surfaceAlt, borderRadius: radii.inner },
      ]}
    >
      <AppText variant="micro" tone="secondary">
        {label}
      </AppText>
      <AppText variant="cardTitle" tabularNums>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statTile: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: 10,
    gap: 2,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 36,
    marginTop: 4,
  },
  bar: { flex: 1, minWidth: 2 },
  quoteBox: { padding: 12, gap: 4 },
  briefActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  briefActionsCompact: { flexDirection: "column" },
  briefAction: { flex: 1 },
  lineBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
