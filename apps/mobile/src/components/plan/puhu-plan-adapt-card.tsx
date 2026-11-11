import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CoachPlanAdaptationDto } from "@mentor/types";
import {
  applyCoachPlanAdaptation,
  fetchPlanAdaptationBrief,
  requestCoachPlanAdaptation,
} from "../../lib/coach-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, Chip } from "../ui/index.js";

interface PuhuPlanAdaptCardProps {
  onApplied: () => void;
}

export function PuhuPlanAdaptCard({ onApplied }: PuhuPlanAdaptCardProps) {
  const { palette, radii, space } = useThemeTokens();
  const t = useTranslations("plan");

  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<CoachPlanAdaptationDto | null>(null);
  const [appliedBanner, setAppliedBanner] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const briefQuery = useQuery({
    queryKey: ["coach", "plan-adaptation-brief"],
    queryFn: fetchPlanAdaptationBrief,
    enabled: expanded,
  });

  const generateMutation = useMutation({
    mutationFn: () => {
      const suggestion = briefQuery.data?.suggestion;
      return requestCoachPlanAdaptation({
        source: "PLAN",
        days: suggestion?.days ?? undefined,
        minutesPerDay: suggestion?.minutesPerDay ?? undefined,
        focusSubjects:
          suggestion?.focusSubjects && suggestion.focusSubjects.length > 0
            ? suggestion.focusSubjects
            : undefined,
      });
    },
    onSuccess: (res) => {
      haptics.lightImpact();
      setErrorMsg(null);
      setAppliedBanner(false);
      setPreview(res);
    },
    onError: (err) => {
      haptics.error();
      setErrorMsg(
        err instanceof Error ? err.message : "Plan önerisi şu an alınamadı.",
      );
    },
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!preview || preview.changes.length === 0) return;
      const sanitizedChanges = preview.changes.map((ch) =>
        ch.kind === "MOVE"
          ? {
              kind: "MOVE" as const,
              taskId: ch.taskId,
              title: ch.title,
              subject: ch.subject,
              fromDate: ch.fromDate,
              toDate: ch.toDate,
            }
          : {
              kind: "ADD" as const,
              title: ch.title,
              subject: ch.subject,
              topic: ch.topic ?? null,
              durationMinutes: ch.durationMinutes ?? null,
              taskDate: ch.taskDate,
            },
      );
      return applyCoachPlanAdaptation({
        planRevision: preview.planRevision,
        source: "PLAN",
        changes: sanitizedChanges,
      });
    },
    onSuccess: () => {
      haptics.success();
      setPreview(null);
      setAppliedBanner(true);
      onApplied();
    },
    onError: (err) => {
      haptics.error();
      setErrorMsg(
        err instanceof Error ? err.message : "Plan uyarlaması uygulanamadı.",
      );
    },
  });

  return (
    <Card style={{ gap: space.sm }}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="sectionHeading">{t("puhu_adapt_title")}</AppText>
          <AppText variant="caption" tone="secondary">
            {t("puhu_adapt_subtitle")}
          </AppText>
        </View>
        <Chip
          label={t("puhu_adapt_cta")}
          selected={expanded}
          onPress={() => {
            haptics.selection();
            setExpanded((prev) => !prev);
          }}
        />
      </View>

      {appliedBanner ? (
        <AppText variant="caption" tone="success">
          {t("puhu_adapt_applied")}
        </AppText>
      ) : null}

      {expanded ? (
        <View style={{ gap: space.sm }}>
          {briefQuery.data?.groundingLine ? (
            <AppText variant="caption" tone="coach">
              {briefQuery.data.groundingLine}
            </AppText>
          ) : null}

          {errorMsg ? (
            <AppText variant="caption" tone="danger">
              {errorMsg}
            </AppText>
          ) : null}

          {!preview ? (
            <Button
              label={t("puhu_adapt_generate_cta")}
              variant="secondary"
              loading={generateMutation.isPending}
              onPress={() => generateMutation.mutate()}
            />
          ) : (
            <View style={{ gap: space.sm }}>
              <View
                style={{
                  padding: space.sm,
                  borderRadius: radii.inner,
                  backgroundColor: palette.surfaceAlt,
                  gap: 4,
                }}
              >
                <AppText variant="body">{preview.message}</AppText>
                {preview.coachNote ? (
                  <AppText variant="caption" tone="secondary">
                    {preview.coachNote}
                  </AppText>
                ) : null}
              </View>

              {preview.changes.map((change, idx) => (
                <View
                  key={`${change.kind}-${idx}`}
                  style={{
                    padding: space.sm,
                    borderRadius: radii.inner,
                    borderWidth: 1,
                    borderColor: palette.border,
                    gap: 4,
                  }}
                >
                  <View style={styles.rowBetween}>
                    <Chip
                      label={
                        change.kind === "MOVE"
                          ? t("puhu_adapt_move_badge")
                          : t("puhu_adapt_add_badge")
                      }
                      selected={change.kind === "ADD"}
                    />
                    <AppText variant="micro" tone="muted">
                      {change.kind === "MOVE"
                        ? `${change.fromDate} → ${change.toDate}`
                        : change.taskDate}
                    </AppText>
                  </View>
                  <AppText variant="cardTitle">{change.title}</AppText>
                  {change.reason ? (
                    <AppText variant="caption" tone="secondary">
                      {change.reason}
                    </AppText>
                  ) : null}
                </View>
              ))}

              {preview.changes.length > 0 ? (
                <Button
                  label={t("puhu_adapt_apply_cta")}
                  loading={applyMutation.isPending}
                  onPress={() => applyMutation.mutate()}
                />
              ) : null}
            </View>
          )}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
});
