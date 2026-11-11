import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatTimerDisplay } from "@mentor/core";
import type { SessionPresetId } from "@mentor/types";
import { SessionDoneCard } from "../../components/session/session-done-card.js";
import { useMobileSessionTimer } from "../../components/session/use-mobile-session-timer.js";
import {
  AppText,
  Button,
  Card,
  Chip,
  TextField,
} from "../../components/ui/index.js";
import { listRecentStudySessions } from "../../lib/coaching-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

const PRESET_OPTIONS = [
  { id: "25_5", labelKey: "preset_25_5" },
  { id: "50_10", labelKey: "preset_50_10" },
  { id: "custom", labelKey: "preset_custom" },
  { id: "stopwatch", labelKey: "preset_stopwatch" },
] as const satisfies readonly { id: SessionPresetId; labelKey: string }[];

export default function StudySessionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    taskId?: string;
    taskTitle?: string;
    subject?: string;
    minutes?: string;
    preset?: string;
  }>();
  const { palette, radii, space, touchTargets } = useThemeTokens();
  const t = useTranslations("session");

  const [subject, setSubject] = useState<string>(params.subject ?? "");
  const [customMinutesInput, setCustomMinutesInput] = useState<string>(
    params.minutes ?? "30",
  );

  const recentQuery = useQuery({
    queryKey: ["study-sessions", "recent"],
    queryFn: () => listRecentStudySessions(5),
  });

  const invalidateAfterSession = () => {
    void queryClient.invalidateQueries({ queryKey: ["coaching", "today"] });
    void queryClient.invalidateQueries({ queryKey: ["plan-tasks"] });
    void queryClient.invalidateQueries({ queryKey: ["economy", "quests"] });
    void queryClient.invalidateQueries({
      queryKey: ["study-sessions", "recent"],
    });
  };

  const timer = useMobileSessionTimer({
    presetParam: params.preset ?? null,
    minutesParam: params.minutes ?? null,
    subject,
    planTaskId: params.taskId ?? null,
    onSessionCompleted: invalidateAfterSession,
  });

  const displaySeconds =
    timer.phase === "focus" && timer.isStopwatch
      ? timer.focusElapsed
      : timer.phase === "idle"
        ? timer.isStopwatch
          ? 0
          : timer.focusMinutes * 60
        : timer.secondsLeft;

  const phaseLabel =
    timer.phase === "break"
      ? t("phase_break")
      : timer.isPaused
        ? t("phase_paused")
        : t("phase_focus");

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space.md,
        paddingBottom: space.xl,
        paddingHorizontal: space.lg,
        gap: space.lg,
      }}
    >
      {/* Top Bar */}
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            haptics.selection();
            router.back();
          }}
          style={[
            styles.backBtn,
            {
              minHeight: touchTargets.min,
              borderColor: palette.border,
              backgroundColor: palette.surface,
              borderRadius: radii.pill,
              paddingHorizontal: space.md,
            },
          ]}
        >
          <AppText variant="caption">‹ {t("back_cta")}</AppText>
        </Pressable>

        {params.taskTitle ? (
          <Chip
            label={`${t("linked_task_prefix")} ${params.taskTitle}`}
            tone="coach"
          />
        ) : null}
      </View>

      <View style={{ gap: space.xs }}>
        <AppText variant="title">{t("title")}</AppText>
        <AppText variant="body" tone="secondary">
          {t("subtitle")}
        </AppText>
      </View>

      {timer.phase === "done" ? (
        <SessionDoneCard
          session={timer.session}
          focusElapsedSeconds={timer.focusElapsed}
          onSubmitFeedback={timer.submitFeedback}
          onReset={timer.reset}
        />
      ) : (
        <>
          {/* Timer Display Card */}
          <Card style={[styles.timerCard, { gap: space.md }]}>
            <Chip
              label={phaseLabel}
              tone={timer.phase === "break" ? "success" : "coach"}
            />
            <AppText variant="display" tabularNums style={styles.clockText}>
              {formatTimerDisplay(displaySeconds)}
            </AppText>
            {subject.trim() ? (
              <AppText variant="caption" tone="secondary">
                {subject.trim()}
              </AppText>
            ) : null}

            {timer.errorMessage ? (
              <AppText variant="caption" tone="danger">
                {timer.errorMessage}
              </AppText>
            ) : null}

            {timer.phase === "idle" ? (
              <View style={{ width: "100%", marginTop: space.sm }}>
                <Button
                  label={t("start_cta")}
                  onPress={() => void timer.start()}
                  disabled={timer.busy}
                  variant="primary"
                />
              </View>
            ) : timer.phase === "focus" ? (
              <View style={[styles.controlsCol, { gap: space.sm }]}>
                <View style={styles.controlsRow}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={timer.isPaused ? t("resume_cta") : t("pause_cta")}
                      onPress={timer.togglePause}
                      disabled={timer.busy}
                      variant="secondary"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={t("complete_cta")}
                      onPress={() => void timer.finalize("COMPLETED")}
                      disabled={timer.busy}
                      variant="primary"
                    />
                  </View>
                </View>
                <Button
                  label={t("abandon_cta")}
                  onPress={() => void timer.finalize("ABANDONED")}
                  disabled={timer.busy}
                  variant="danger"
                />
              </View>
            ) : (
              <View style={{ width: "100%" }}>
                <Button
                  label={t("skip_break_cta")}
                  onPress={timer.skipBreak}
                  variant="secondary"
                />
              </View>
            )}
          </Card>

          {/* Preset & Setup Controls (visible when idle) */}
          {timer.phase === "idle" ? (
            <Card style={{ gap: space.md }}>
              <View style={styles.presetGrid}>
                {PRESET_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.id}
                    label={t(opt.labelKey)}
                    selected={timer.preset === opt.id}
                    onPress={() => timer.selectPreset(opt.id)}
                  />
                ))}
              </View>

              {timer.preset === "custom" ? (
                <TextField
                  label={t("custom_minutes_label")}
                  keyboardType="number-pad"
                  value={customMinutesInput}
                  onChangeText={(val) => {
                    setCustomMinutesInput(val);
                    const num = Number(val);
                    if (Number.isFinite(num) && num >= 5) {
                      timer.setCustomMinutes(num);
                    }
                  }}
                />
              ) : null}

              <TextField
                label={t("subject_label")}
                placeholder={t("subject_placeholder")}
                value={subject}
                onChangeText={setSubject}
              />
            </Card>
          ) : null}
        </>
      )}

      {/* Recent Completed Sessions */}
      {recentQuery.data && recentQuery.data.length > 0 ? (
        <Card style={{ gap: space.md }}>
          <AppText variant="cardTitle">{t("recent_title")}</AppText>
          <View style={{ gap: space.sm }}>
            {recentQuery.data.map((item) => {
              const mins = Math.max(1, Math.round(item.actualFocusSeconds / 60));
              return (
                <View
                  key={item.id}
                  style={[
                    styles.recentRow,
                    {
                      borderColor: palette.border,
                      backgroundColor: palette.surfaceAlt,
                      borderRadius: radii.inner,
                      padding: space.md,
                    },
                  ]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="body">
                      {item.planTaskTitle ?? item.subject ?? t("title")}
                    </AppText>
                    {item.aiReflection ? (
                      <AppText variant="caption" tone="coach">
                        {item.aiReflection}
                      </AppText>
                    ) : null}
                  </View>
                  <Chip label={t("recent_item", { minutes: mins })} tone="success" />
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  backBtn: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  timerCard: {
    alignItems: "center",
  },
  clockText: {
    fontSize: 54,
    lineHeight: 62,
  },
  controlsCol: {
    width: "100%",
  },
  controlsRow: {
    flexDirection: "row",
    gap: 10,
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    gap: 8,
  },
});
