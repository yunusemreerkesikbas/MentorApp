import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  NOTEBOOK_ERROR_TYPES,
  type CoachingAnalysisDto,
  type ExamSubjectDto,
  type NotebookEntryDto,
  type NotebookErrorType,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import {
  createNotebookEntry,
  reviewNotebookEntry,
} from "../../lib/analysis-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, Chip, TextField } from "../ui/index.js";

export interface MistakeNotebookViewProps {
  examId: string;
  subjects: ExamSubjectDto[];
  analysis: CoachingAnalysisDto | null;
  dueEntries: NotebookEntryDto[];
  recentEntries: NotebookEntryDto[];
  onRefresh: () => void;
}

const ERROR_LABEL_KEYS: Record<
  NotebookErrorType,
  | "error_UNKNOWN_TOPIC"
  | "error_CARELESS"
  | "error_MISREAD"
  | "error_DISTRACTOR"
  | "error_TIME"
  | "error_CHANGED_ANSWER"
> = {
  UNKNOWN_TOPIC: "error_UNKNOWN_TOPIC",
  CARELESS: "error_CARELESS",
  MISREAD: "error_MISREAD",
  DISTRACTOR: "error_DISTRACTOR",
  TIME: "error_TIME",
  CHANGED_ANSWER: "error_CHANGED_ANSWER",
};

export function MistakeNotebookView({
  examId,
  subjects,
  analysis,
  dueEntries,
  recentEntries,
  onRefresh,
}: MistakeNotebookViewProps) {
  const t = useTranslations("analysis");
  const tCommon = useTranslations("common");
  const { palette, radii, space } = useThemeTokens();

  const [selectedSubjectSlug, setSelectedSubjectSlug] = useState<string | null>(
    subjects[0]?.slug ?? null,
  );
  const [errorType, setErrorType] = useState<NotebookErrorType>("UNKNOWN_TOPIC");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const handleSaveEntry = async () => {
    if (saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await createNotebookEntry({
        examId,
        source: "OWN",
        subjectRef: selectedSubjectSlug,
        errorType,
        note: note.trim() || null,
      });
      haptics.success();
      setNote("");
      onRefresh();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : tCommon("error_body"),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (id: string, solved: boolean) => {
    if (reviewingId) return;
    setReviewingId(id);
    try {
      await reviewNotebookEntry(id, solved);
      haptics.success();
      onRefresh();
    } finally {
      setReviewingId(null);
    }
  };

  const stats = analysis?.notebookStats;

  return (
    <View style={{ gap: space.lg }}>
      {/* Stats & Error Pattern Summary */}
      <Card style={{ gap: space.sm }}>
        <AppText variant="cardTitle">{t("notebook_stats_title")}</AppText>
        {stats ? (
          <AppText variant="body" tone="secondary" tabularNums>
            {t("notebook_stats_summary", {
              due: stats.dueCount,
              healed: stats.healedCount,
              saved: stats.savedCount,
            })}
          </AppText>
        ) : null}
        {analysis?.notebookErrorMessage ? (
          <AppText variant="caption" tone="coach">
            {analysis.notebookErrorMessage}
          </AppText>
        ) : null}
      </Card>

      {/* Due Today (2/7/21d Spaced Review Ladder) */}
      <Card style={{ gap: space.md }}>
        <View style={styles.headerRow}>
          <AppText variant="cardTitle">{t("due_reviews_title")}</AppText>
          <Chip label={String(dueEntries.length)} tone="warning" />
        </View>

        {dueEntries.length === 0 ? (
          <AppText variant="body" tone="secondary">
            {t("due_empty")}
          </AppText>
        ) : (
          <View style={{ gap: space.sm }}>
            {dueEntries.map((entry) => {
              const isBusy = reviewingId === entry.id;
              return (
                <View
                  key={entry.id}
                  style={[
                    styles.entryCard,
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
                    <AppText variant="body">
                      {entry.subjectName ?? t("mistake_subject_label")}
                      {entry.topicName ? ` · ${entry.topicName}` : ""}
                    </AppText>
                    <Chip
                      label={t(ERROR_LABEL_KEYS[entry.errorType])}
                      tone="warning"
                    />
                  </View>

                  {entry.note ? (
                    <AppText variant="caption" tone="secondary">
                      {entry.note}
                    </AppText>
                  ) : null}

                  <View style={styles.reviewButtonsRow}>
                    <View style={{ flex: 1 }}>
                      <Button
                        label={t("review_solved_cta")}
                        onPress={() => void handleReview(entry.id, true)}
                        disabled={isBusy}
                        variant="primary"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        label={t("review_unsolved_cta")}
                        onPress={() => void handleReview(entry.id, false)}
                        disabled={isBusy}
                        variant="secondary"
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      {/* Add Mistake to Notebook */}
      <Card style={{ gap: space.md }}>
        <AppText variant="cardTitle">{t("add_mistake_title")}</AppText>

        <View style={{ gap: space.xs }}>
          <AppText variant="caption" tone="secondary">
            {t("mistake_subject_label")}
          </AppText>
          <View style={styles.chipWrap}>
            {subjects.map((sub) => (
              <Chip
                key={sub.slug}
                label={sub.name}
                selected={selectedSubjectSlug === sub.slug}
                onPress={() => setSelectedSubjectSlug(sub.slug)}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: space.xs }}>
          <AppText variant="caption" tone="secondary">
            {t("mistake_error_type_label")}
          </AppText>
          <View style={styles.chipWrap}>
            {NOTEBOOK_ERROR_TYPES.map((type) => (
              <Chip
                key={type}
                label={t(ERROR_LABEL_KEYS[type])}
                selected={errorType === type}
                onPress={() => setErrorType(type)}
              />
            ))}
          </View>
        </View>

        <TextField
          label={t("mistake_note_label")}
          placeholder={t("mistake_note_placeholder")}
          value={note}
          onChangeText={setNote}
        />

        {errorMsg ? (
          <AppText variant="caption" tone="danger">
            {errorMsg}
          </AppText>
        ) : null}

        <Button
          label={saving ? tCommon("loading") : t("save_mistake_cta")}
          onPress={() => void handleSaveEntry()}
          disabled={saving}
          variant="primary"
        />
      </Card>

      {/* Recent Mistake Entries */}
      {recentEntries.length > 0 ? (
        <Card style={{ gap: space.md }}>
          <AppText variant="cardTitle">{t("recent_mistakes_title")}</AppText>
          <View style={{ gap: space.sm }}>
            {recentEntries.map((entry) => {
              const statusKey =
                entry.status === "HEALED"
                  ? "status_HEALED"
                  : entry.status === "ARCHIVED"
                    ? "status_ARCHIVED"
                    : "status_ACTIVE";
              return (
                <View
                  key={entry.id}
                  style={[
                    styles.entryCard,
                    {
                      backgroundColor: palette.surfaceAlt,
                      borderColor: palette.border,
                      borderRadius: radii.inner,
                      padding: space.md,
                      gap: 4,
                    },
                  ]}
                >
                  <View style={styles.headerRow}>
                    <AppText variant="body">
                      {entry.subjectName ?? t("mistake_subject_label")}
                    </AppText>
                    <View style={styles.chipWrap}>
                      <Chip
                        label={t(ERROR_LABEL_KEYS[entry.errorType])}
                        tone="default"
                      />
                      <Chip
                        label={t(statusKey)}
                        tone={entry.status === "HEALED" ? "success" : "coach"}
                      />
                    </View>
                  </View>
                  {entry.note ? (
                    <AppText variant="caption" tone="secondary">
                      {entry.note}
                    </AppText>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  entryCard: {
    borderWidth: 1,
  },
  reviewButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
});
