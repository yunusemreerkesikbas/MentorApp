import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import { CalendarIcon } from "@solar-icons/react-native/linear/calendar";
import { useMutation } from "@tanstack/react-query";
import {
  emptyScores, formatDateLabel, paperSubjects, recordedMockExamRows,
  scoresFromMockExam, subjectTotal, todayIso, validateSubjectCounts, withScore,
} from "@mentor/core";
import type { ExamSubjectDto, ExamSummaryDto, MockExamDto } from "@mentor/types";
import { createMockExam, updateMockExam } from "../../lib/analysis-api.js";
import { haptics } from "../../lib/haptics.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { PanelCard, PanelCardTitle } from "../panel/primitives.js";
import { AppText, Button, TextField } from "../ui/index.js";
import { AnalysisDateSheet } from "./analysis-date-sheet.js";
import { AnalysisLink } from "./analysis-link.js";

export function MockExamEntryView({ exam, subjects, onSaved, prior, edit, onCancel }: {
  exam: ExamSummaryDto;
  subjects: ExamSubjectDto[];
  onSaved: (mock: MockExamDto) => void;
  prior?: MockExamDto;
  edit?: MockExamDto;
  onCancel?: () => void;
}) {
  const { locale } = useLocale();
  const t = useTranslations("analysisEntry");
  const tAnalysis = useTranslations("analysis");
  const tHistory = useTranslations("analysisHistory");
  const tCommon = useTranslations("common");
  const { palette, radii, space, touchTargets } = useThemeTokens();
  const sections = paperSubjects(subjects);
  const [publisherName, setPublisherName] = useState(edit?.publisherName ?? "");
  const [date, setDate] = useState(edit?.takenAt.slice(0, 10) ?? todayIso());
  const [dateOpen, setDateOpen] = useState(false);
  const dateLabel = formatDateLabel(date, locale, "", { alwaysFull: true });
  const [scores, setScores] = useState(() => edit ? scoresFromMockExam(subjects, edit.subjects) : emptyScores(subjects));
  const rows = recordedMockExamRows(sections, scores);
  const overflowSlug = validateSubjectCounts(sections, scores);
  const questionCount = sections.reduce((total, subject) => total + (subject.questionCount ?? 0), 0);
  const save = useMutation({
    mutationFn: () => {
      const takenAt = edit?.takenAt.slice(0, 10) === date
        ? edit.takenAt
        : new Date(`${date}T12:00:00+03:00`).toISOString();
      const publisher = publisherName.trim();
      return edit ? updateMockExam(edit.id, { takenAt, publisherName: publisher || null, subjects: rows })
        : createMockExam({ examId: exam.id, takenAt: date === todayIso() ? undefined : takenAt, publisherName: publisher || undefined, subjects: rows });
    },
    onSuccess: (item) => {
      Keyboard.dismiss();
      haptics.success();
      onSaved(item);
    },
  });
  const setField = (subject: ExamSubjectDto, field: "correct" | "wrong" | "blank", value: string) => {
    setScores((previous) => {
      const row = previous[subject.slug];
      return row ? { ...previous, [subject.slug]: withScore(row, field, value.replace(/[^0-9]/g, ""), subject.questionCount) } : previous;
    });
  };

  return (
    <PanelCard style={{ gap: space.md }}>
      <PanelCardTitle>{edit ? tHistory("edit_title") : t("result_entry_title")}</PanelCardTitle>
      <AppText tone="secondary" variant="caption">{t("caption", { exam: exam.name, subjects: sections.length, questions: questionCount })}</AppText>
      {!edit && prior ? (
        <AnalysisLink label={t("copy_last")} onPress={() => {
          setPublisherName(prior.publisherName ?? "");
          setScores(scoresFromMockExam(subjects, prior.subjects));
        }} />
      ) : null}
      <TextField label={t("publisher_label")} placeholder={tAnalysis("publisher_placeholder")}
        value={publisherName} onChangeText={setPublisherName} maxLength={120} />
      <View style={{ gap: space.xs }}>
        <AppText variant="caption" tone="secondary">{t("taken_at_label")}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={t("taken_at_label")} accessibilityValue={{ text: dateLabel }} onPress={() => {
          Keyboard.dismiss();
          setDateOpen(true);
        }} style={[styles.date, {
          borderColor: palette.border, backgroundColor: palette.surfaceAlt, borderRadius: radii.inner,
          paddingHorizontal: space.md, minHeight: touchTargets.comfortable,
        }]}>
          <AppText>{dateLabel}</AppText>
          <CalendarIcon size={20} color={palette.secondary} />
        </Pressable>
      </View>
      {dateOpen ? <AnalysisDateSheet initialDate={date} onClose={() => setDateOpen(false)} onApply={(value) => {
        setDate(value);
        setDateOpen(false);
      }} /> : null}
      <AppText variant="caption" tone="secondary">{t("blank_hint")}</AppText>
      {sections.map((subject) => {
        const row = scores[subject.slug];
        if (!row) return null;
        const bad = subject.questionCount != null && subjectTotal(row) > subject.questionCount;
        return (
          <View key={subject.slug} style={{
            backgroundColor: palette.surfaceAlt, borderColor: bad ? palette.danger : palette.border,
            borderRadius: radii.inner, borderWidth: StyleSheet.hairlineWidth, padding: space.sm, gap: space.sm,
          }}>
            <View style={[styles.date, { gap: space.sm }]}>
              <AppText variant="caption" style={{ fontWeight: "800", flex: 1 }}>{subject.name}</AppText>
              <AppText variant="micro" tone="secondary">{t("questions_count", { count: subject.questionCount ?? 0 })}</AppText>
            </View>
            <View style={[styles.inputs, { gap: space.sm }]}>
              {(["correct", "wrong", "blank"] as const).map((field) => (
                <View key={field} style={{ flex: 1, minWidth: 0 }}>
                  <TextField label={tAnalysis(`${field}_short`)}
                    accessibilityLabel={`${subject.name}, ${tAnalysis(`${field}_short`)}`}
                    keyboardType="number-pad" maxLength={3} placeholder="0" value={row[field]}
                    onChangeText={(value) => setField(subject, field, value)} />
                </View>
              ))}
            </View>
            {bad ? <AppText variant="caption" tone="danger">{t("validation_over_count", {
              subject: subject.name, total: subjectTotal(row), max: subject.questionCount ?? 0,
            })}</AppText> : null}
          </View>
        );
      })}
      {save.isError ? (
        <AppText accessibilityLiveRegion="polite" variant="caption" tone="danger">
          {save.error instanceof Error ? save.error.message : tCommon("error_body")}
        </AppText>
      ) : null}
      <Button label={edit ? tHistory("save_edit") : t("save")} onPress={() => {
        if (!save.isPending && !overflowSlug && rows.length) save.mutate();
      }} disabled={Boolean(overflowSlug) || rows.length === 0} loading={save.isPending} />
      {onCancel ? <AnalysisLink label={tHistory("cancel_edit")} onPress={onCancel} /> : null}
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  date: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  inputs: { flexDirection: "row" },
});
