import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  emptyScores,
  paperSubjects,
  validateSubjectCounts,
  withScore,
  type SubjectScores,
} from "@mentor/core";
import type { ExamSubjectDto, ExamSummaryDto, MockExamDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { createMockExam } from "../../lib/analysis-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, Chip, TextField } from "../ui/index.js";

export interface MockExamEntryViewProps {
  exam: ExamSummaryDto;
  subjects: ExamSubjectDto[];
  onSaved: (mock: MockExamDto) => void;
}

export function MockExamEntryView({
  exam,
  subjects,
  onSaved,
}: MockExamEntryViewProps) {
  const t = useTranslations("analysis");
  const { palette, radii, space } = useThemeTokens();
  const sections = paperSubjects(subjects);

  const [publisherName, setPublisherName] = useState("");
  const [scores, setScores] = useState<Record<string, SubjectScores>>(() =>
    emptyScores(subjects),
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedNet, setSavedNet] = useState<string | null>(null);

  const handleFieldChange = (
    slug: string,
    field: "correct" | "wrong" | "blank",
    value: string,
    questionCount: number | null,
  ) => {
    const clean = value.replace(/[^0-9]/g, "");
    setScores((prev) => {
      const current = prev[slug] ?? {
        correct: "",
        wrong: "",
        blank: "",
        blankManual: false,
      };
      return {
        ...prev,
        [slug]: withScore(current, field, clean, questionCount),
      };
    });
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setErrorMessage(null);
    setSavedNet(null);

    const overflowSlug = validateSubjectCounts(sections, scores);
    if (overflowSlug) {
      setErrorMessage(t("count_overflow_error"));
      return;
    }

    const rows = sections.map((sub) => ({
      subjectRef: sub.slug,
      correct: Number(scores[sub.slug]?.correct || 0),
      wrong: Number(scores[sub.slug]?.wrong || 0),
      blank: Number(scores[sub.slug]?.blank || 0),
    }));

    setSubmitting(true);
    try {
      const created = await createMockExam({
        examId: exam.id,
        publisherName: publisherName.trim() || undefined,
        subjects: rows,
      });
      haptics.success();
      setSavedNet(created.totalNet);
      setPublisherName("");
      setScores(emptyScores(subjects));
      onSaved(created);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : t("count_overflow_error"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card style={{ gap: space.md }}>
      <View style={styles.headerRow}>
        <AppText variant="cardTitle">{exam.name}</AppText>
        {savedNet ? (
          <Chip
            label={t("saved_mock_banner", { net: savedNet })}
            tone="success"
          />
        ) : null}
      </View>

      <TextField
        label={t("publisher_label")}
        placeholder={t("publisher_placeholder")}
        value={publisherName}
        onChangeText={setPublisherName}
      />

      <View style={{ gap: space.sm }}>
        {sections.map((sub) => {
          const row = scores[sub.slug] ?? {
            correct: "",
            wrong: "",
            blank: "",
            blankManual: false,
          };
          return (
            <View
              key={sub.slug}
              style={[
                styles.subjectCard,
                {
                  backgroundColor: palette.surfaceAlt,
                  borderColor: palette.border,
                  borderRadius: radii.inner,
                  padding: space.md,
                  gap: space.sm,
                },
              ]}
            >
              <View style={styles.headerRow}>
                <AppText variant="body">{sub.name}</AppText>
                {sub.questionCount != null ? (
                  <AppText variant="micro" tone="muted" tabularNums>
                    {t("question_count_label", { count: sub.questionCount })}
                  </AppText>
                ) : null}
              </View>

              <View style={styles.inputsRow}>
                <View style={{ flex: 1 }}>
                  <TextField
                    label={t("correct_short")}
                    keyboardType="number-pad"
                    placeholder="0"
                    value={row.correct}
                    onChangeText={(val) =>
                      handleFieldChange(
                        sub.slug,
                        "correct",
                        val,
                        sub.questionCount,
                      )
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    label={t("wrong_short")}
                    keyboardType="number-pad"
                    placeholder="0"
                    value={row.wrong}
                    onChangeText={(val) =>
                      handleFieldChange(
                        sub.slug,
                        "wrong",
                        val,
                        sub.questionCount,
                      )
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    label={t("blank_short")}
                    keyboardType="number-pad"
                    placeholder="0"
                    value={row.blank}
                    onChangeText={(val) =>
                      handleFieldChange(
                        sub.slug,
                        "blank",
                        val,
                        sub.questionCount,
                      )
                    }
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {errorMessage ? (
        <AppText variant="caption" tone="danger">
          {errorMessage}
        </AppText>
      ) : null}

      <Button
        label={submitting ? t("saving_mock_cta") : t("save_mock_cta")}
        onPress={() => void handleSubmit()}
        disabled={submitting || sections.length === 0}
        variant="primary"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  subjectCard: {
    borderWidth: 1,
  },
  inputsRow: {
    flexDirection: "row",
    gap: 8,
  },
});
