import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { formatTrendDate } from "@mentor/core";
import type {
  CoachingAnalysisDto,
  MockExamDto,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import {
  createAnalysisFocusPlanTask,
  deleteMockExam,
} from "../../lib/analysis-api.js";
import { haptics } from "../../lib/haptics.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, Chip, StateView } from "../ui/index.js";

export interface AnalysisProgressViewProps {
  examId: string;
  analysis: CoachingAnalysisDto | null;
  mockExams: MockExamDto[];
  onOpenEntryTab: () => void;
  onOpenCoachForExam: (mockExam: MockExamDto) => void;
  onRefresh: () => void;
}

export function AnalysisProgressView({
  examId,
  analysis,
  mockExams,
  onOpenEntryTab,
  onOpenCoachForExam,
  onRefresh,
}: AnalysisProgressViewProps) {
  const { locale } = useLocale();
  const t = useTranslations("analysis");
  const { palette, radii, space } = useThemeTokens();
  const [addingFocus, setAddingFocus] = useState(false);
  const [focusAdded, setFocusAdded] = useState(false);
  const [focusError, setFocusError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!analysis || (mockExams.length === 0 && analysis.subjects.length === 0)) {
    return (
      <StateView
        title={t("empty_title")}
        body={t("empty_body")}
        actionLabel={t("add_mock_cta")}
        onAction={onOpenEntryTab}
        tone="empty"
      />
    );
  }

  const latestExamId =
    analysis.ghost?.latest.id ?? mockExams[0]?.id ?? null;

  const handleAddFocusToPlan = async () => {
    const focus = analysis.nextFocus;
    if (!focus || !latestExamId || addingFocus) return;
    setAddingFocus(true);
    setFocusError(null);
    try {
      await createAnalysisFocusPlanTask({
        examId,
        baselineMockExamId: latestExamId,
        expectedSubjectRef: focus.subjectRef,
        expectedTopicRef: focus.topicRef ?? null,
        title: focus.suggestedTaskTitle,
      });
      haptics.success();
      setFocusAdded(true);
      onRefresh();
    } catch (err) {
      setFocusError(
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : t("focus_add_plan_cta"),
      );
    } finally {
      setAddingFocus(false);
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await deleteMockExam(id);
      haptics.selection();
      onRefresh();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      {/* Personal Record & Ghost ("Geçmiş-Ben") Card */}
      {analysis.ghost ? (
        <Card style={{ gap: space.md }}>
          <View style={styles.headerRow}>
            <AppText variant="cardTitle">{t("ghost_title")}</AppText>
            {analysis.ghost.isNewRecord ? (
              <Chip label={t("ghost_new_record")} tone="success" />
            ) : null}
          </View>

          <AppText variant="title" tabularNums>
            {t("net_suffix", { net: analysis.ghost.latest.totalNet })}
          </AppText>

          <AppText variant="body" tone="main">
            {analysis.ghost.headline}
          </AppText>

          <View style={styles.chipRow}>
            <Chip
              label={t("ghost_prev_delta", {
                delta: analysis.ghost.previousDelta,
              })}
              tone={analysis.ghost.beatPrevious ? "success" : "default"}
            />
            <Chip
              label={t("ghost_best_delta", {
                delta: analysis.ghost.recordDelta,
              })}
              tone={analysis.ghost.isNewRecord ? "success" : "default"}
            />
          </View>

          {analysis.ghost.aiNarration ? (
            <AppText variant="caption" tone="coach">
              {analysis.ghost.aiNarration}
            </AppText>
          ) : null}
        </Card>
      ) : analysis.personalRecordNet ? (
        <Card style={{ gap: space.xs }}>
          <AppText variant="caption" tone="secondary">
            {t("personal_record_label")}
          </AppText>
          <AppText variant="title" tabularNums>
            {t("net_suffix", { net: analysis.personalRecordNet })}
          </AppText>
        </Card>
      ) : null}

      {/* Next Study Focus Card */}
      {analysis.nextFocus ? (
        <Card variant="coach" style={{ gap: space.md }}>
          <View style={styles.headerRow}>
            <AppText variant="cardTitle">{t("focus_title")}</AppText>
            <Chip
              label={
                analysis.nextFocus.topicName
                  ? `${analysis.nextFocus.subjectName} · ${analysis.nextFocus.topicName}`
                  : analysis.nextFocus.subjectName
              }
              tone="coach"
            />
          </View>
          <AppText variant="body" tone="main">
            {analysis.nextFocus.message}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {analysis.nextFocus.trendMessage}
          </AppText>

          {focusError ? (
            <AppText variant="caption" tone="danger">
              {focusError}
            </AppText>
          ) : null}

          {focusAdded ? (
            <AppText variant="caption" tone="success">
              {t("focus_added_plan")}
            </AppText>
          ) : latestExamId ? (
            <Button
              label={t("focus_add_plan_cta")}
              onPress={() => void handleAddFocusToPlan()}
              disabled={addingFocus}
              variant="primary"
            />
          ) : null}
        </Card>
      ) : null}

      {/* Subject Strengths Card */}
      {analysis.subjects.length > 0 ? (
        <Card style={{ gap: space.md }}>
          <AppText variant="cardTitle">{t("subjects_title")}</AppText>
          <View style={{ gap: space.sm }}>
            {analysis.subjects.map((sub) => (
              <View
                key={sub.subjectRef}
                style={[
                  styles.rowCard,
                  {
                    backgroundColor: palette.surfaceAlt,
                    borderColor: palette.border,
                    borderRadius: radii.inner,
                    padding: space.md,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="body">{sub.subjectName}</AppText>
                  <AppText variant="micro" tone="muted" tabularNums>
                    {t("subject_avg", {
                      net: sub.averageNet,
                      count: sub.attemptCount,
                    })}
                  </AppText>
                </View>
                {sub.netDelta ? (
                  <Chip
                    label={`${sub.netDelta} net`}
                    tone={sub.netDelta.startsWith("-") ? "warning" : "success"}
                  />
                ) : (
                  <Chip
                    label={t("net_suffix", { net: sub.averageNet })}
                    tone="default"
                  />
                )}
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {/* Recent Mock Exams List */}
      {mockExams.length > 0 ? (
        <Card style={{ gap: space.md }}>
          <AppText variant="cardTitle">{t("history_title")}</AppText>
          <View style={{ gap: space.sm }}>
            {mockExams.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.examCard,
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
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="body">
                      {item.publisherName ?? item.examName}
                    </AppText>
                    <AppText variant="micro" tone="muted">
                      {formatTrendDate(item.takenAt, locale)}
                    </AppText>
                  </View>
                  <Chip
                    label={t("net_suffix", { net: item.totalNet })}
                    tone="success"
                  />
                </View>

                <View style={styles.actionsRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      haptics.selection();
                      onOpenCoachForExam(item);
                    }}
                    style={[
                      styles.actionPill,
                      {
                        backgroundColor: palette.ctaPlayBg,
                        borderColor: palette.ctaPlayEdge,
                        borderRadius: radii.pill,
                        paddingHorizontal: space.md,
                        paddingVertical: space.xs + 2,
                      },
                    ]}
                  >
                    <AppText
                      variant="caption"
                      style={{ color: palette.ctaPlayInk }}
                    >
                      {t("ask_puhu_cta")}
                    </AppText>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    disabled={deletingId === item.id}
                    onPress={() => void handleDeleteExam(item.id)}
                    style={[
                      styles.actionPill,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                        borderRadius: radii.pill,
                        paddingHorizontal: space.md,
                        paddingVertical: space.xs + 2,
                      },
                    ]}
                  >
                    <AppText variant="caption" tone="danger">
                      {t("delete_mock_cta")}
                    </AppText>
                  </Pressable>
                </View>
              </View>
            ))}
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
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    gap: 8,
  },
  examCard: {
    borderWidth: 1,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  actionPill: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
