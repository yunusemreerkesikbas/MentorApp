import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { todayInIstanbul } from "@mentor/core";
import {
  assignStudentTasks,
  endStudentLink,
  fetchStudentReport,
  generateStudentBrief,
  setCoachNote,
  setStudentAttention,
} from "../../lib/mentorship-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, TextField } from "../ui/index.js";

export interface StudentReportPanelProps {
  studentId: string;
  onClose: () => void;
}

export function StudentReportPanel({
  studentId,
  onClose,
}: StudentReportPanelProps) {
  const t = useTranslations("students");
  const { palette, radii, space } = useThemeTokens();
  const queryClient = useQueryClient();

  const reportQuery = useQuery({
    queryKey: ["mentorship-student-report", studentId],
    queryFn: () => fetchStudentReport(studentId),
  });

  const report = reportQuery.data;
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [homeworkTitle, setHomeworkTitle] = useState("");
  const [homeworkSubject, setHomeworkSubject] = useState("");
  const [homeworkNote, setHomeworkNote] = useState("");
  const [briefText, setBriefText] = useState<string | null>(null);

  const attentionMutation = useMutation({
    mutationFn: (attended: boolean) => setStudentAttention(studentId, attended),
    onSuccess: () => {
      void haptics.selection();
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["mentorship-student-report", studentId],
        }),
        queryClient.invalidateQueries({ queryKey: ["mentorship-roster"] }),
      ]);
    },
  });

  const noteMutation = useMutation({
    mutationFn: () =>
      setCoachNote(
        studentId,
        (noteDraft ?? report?.coachNote?.body ?? "").trim() || null,
      ),
    onSuccess: () => {
      void haptics.success();
      void queryClient.invalidateQueries({
        queryKey: ["mentorship-student-report", studentId],
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      assignStudentTasks(studentId, [
        {
          title: homeworkTitle.trim(),
          subject: homeworkSubject.trim() || null,
          coachNote: homeworkNote.trim() || null,
          taskDate: todayInIstanbul(),
        },
      ]),
    onSuccess: () => {
      void haptics.success();
      setHomeworkTitle("");
      setHomeworkSubject("");
      setHomeworkNote("");
      void queryClient.invalidateQueries({
        queryKey: ["mentorship-student-report", studentId],
      });
    },
  });

  const briefMutation = useMutation({
    mutationFn: () => generateStudentBrief(studentId),
    onSuccess: (res) => {
      void haptics.selection();
      setBriefText(res.brief);
    },
  });

  const endLinkMutation = useMutation({
    mutationFn: () => endStudentLink(studentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mentorship-roster"] });
      void queryClient.invalidateQueries({ queryKey: ["mentorship-overview"] });
      onClose();
    },
  });

  if (!report) {
    return null;
  }

  const effectiveNote = noteDraft ?? report.coachNote?.body ?? "";

  return (
    <Card
      style={{
        gap: space.sm,
        borderColor: palette.coachAccent,
        backgroundColor: palette.surface,
      }}
    >
      <View style={styles.rowBetween}>
        <AppText variant="sectionHeading">{report.studentDisplayName}</AppText>
        <Button
          label={t("close_report_cta")}
          variant="secondary"
          onPress={onClose}
        />
      </View>

      <AppText variant="caption" tone="secondary" tabularNums>
        {t("focus_7d", { minutes: report.activity.focusMinutes7d })} ·{" "}
        {t("streak_days", { days: report.activity.currentStreak })}
        {report.planCompletionRate7d !== null
          ? ` · ${t("plan_completion_7d", {
              percent: Math.round(report.planCompletionRate7d * 100),
            })}`
          : ""}
      </AppText>

      {report.riskFlags.length > 0 ? (
        <Button
          label={
            report.needsAttention
              ? t("mark_attended_cta")
              : t("unmark_attended_cta")
          }
          variant="secondary"
          loading={attentionMutation.isPending}
          onPress={() => attentionMutation.mutate(report.needsAttention)}
        />
      ) : null}

      {report.studentNote ? (
        <View
          style={{
            padding: space.sm,
            borderRadius: radii.card,
            borderWidth: 1,
            backgroundColor: palette.surfaceAlt,
            borderColor: palette.border,
            gap: 4,
          }}
        >
          <AppText variant="caption" tone="coach">
            {t("student_note_title")}
          </AppText>
          <AppText variant="body">{report.studentNote.body}</AppText>
        </View>
      ) : null}

      <TextField
        label={t("coach_note_label")}
        value={effectiveNote}
        onChangeText={setNoteDraft}
        placeholder={t("coach_note_placeholder")}
        multiline
      />
      <Button
        label={t("save_note_cta")}
        variant="secondary"
        loading={noteMutation.isPending}
        onPress={() => noteMutation.mutate()}
      />

      <AppText variant="sectionHeading">{t("assign_homework_title")}</AppText>
      <TextField
        label={t("homework_title_label")}
        value={homeworkTitle}
        onChangeText={setHomeworkTitle}
        placeholder={t("homework_title_placeholder")}
      />
      <TextField
        label={t("homework_subject_label")}
        value={homeworkSubject}
        onChangeText={setHomeworkSubject}
      />
      <TextField
        label={t("homework_note_label")}
        value={homeworkNote}
        onChangeText={setHomeworkNote}
        placeholder={t("homework_note_placeholder")}
      />
      <Button
        label={t("assign_task_cta")}
        disabled={!homeworkTitle.trim()}
        loading={assignMutation.isPending}
        onPress={() => assignMutation.mutate()}
      />

      <AppText variant="sectionHeading">{t("student_brief_title")}</AppText>
      {briefText ? <AppText variant="body">{briefText}</AppText> : null}
      <Button
        label={t("generate_student_brief_cta")}
        variant="secondary"
        loading={briefMutation.isPending}
        onPress={() => briefMutation.mutate()}
      />

      <Button
        label={t("end_student_link_cta")}
        variant="danger"
        loading={endLinkMutation.isPending}
        onPress={() => endLinkMutation.mutate()}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
});
