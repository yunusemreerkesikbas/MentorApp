import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import type { StudySessionDto } from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import { scheduleSessionReturnReminder } from "../../lib/notifications-api.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, Chip, TextField } from "../ui/index.js";

export interface SessionDoneCardProps {
  session: StudySessionDto | null;
  focusElapsedSeconds: number;
  onSubmitFeedback: (mood: number, struggleNote?: string) => Promise<void>;
  onReset: () => void;
}

const FEEDBACK_OPTIONS = [
  { value: 1, emoji: "😩", labelKey: "feedback_mood_1" },
  { value: 2, emoji: "😐", labelKey: "feedback_mood_2" },
  { value: 3, emoji: "🙂", labelKey: "feedback_mood_3" },
] as const;

export function SessionDoneCard({
  session,
  focusElapsedSeconds,
  onSubmitFeedback,
  onReset,
}: SessionDoneCardProps) {
  const t = useTranslations("session");
  const { palette, radii, space, touchTargets } = useThemeTokens();
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [struggleNote, setStruggleNote] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const reminder = useMutation({
    mutationFn: () => scheduleSessionReturnReminder(session?.subject),
    onSuccess: haptics.success,
    onError: haptics.error,
  });

  const minutes = Math.max(
    1,
    Math.round((session?.actualFocusSeconds ?? focusElapsedSeconds) / 60),
  );

  const handleSaveFeedback = async () => {
    if (!selectedMood || saving) return;
    setSaving(true);
    try {
      await onSubmitFeedback(selectedMood, struggleNote);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <AppText variant="sectionHeading">{t("phase_done")}</AppText>
        <AppText variant="body" tone="secondary" tabularNums>
          {t("done_summary", { minutes })}
        </AppText>
        {session?.planTaskAutoCompleted ? (
          <View style={{ marginTop: 4 }}>
            <Chip label={t("done_task_completed")} tone="success" />
          </View>
        ) : null}
      </View>

      {!saved ? (
        <View style={{ gap: space.md }}>
          <AppText variant="cardTitle">{t("feedback_title")}</AppText>

          <View style={styles.moodRow}>
            {FEEDBACK_OPTIONS.map((item) => {
              const isSelected = selectedMood === item.value;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    haptics.selection();
                    setSelectedMood(item.value);
                  }}
                  style={[
                    styles.moodBtn,
                    {
                      minHeight: touchTargets.min,
                      borderRadius: radii.inner,
                      borderColor: isSelected
                        ? palette.ctaPlayEdge
                        : palette.border,
                      backgroundColor: isSelected
                        ? palette.ctaPlayBg
                        : palette.surfaceAlt,
                      paddingVertical: space.sm,
                    },
                  ]}
                >
                  <AppText variant="cardTitle">{item.emoji}</AppText>
                  <AppText
                    variant="caption"
                    style={{
                      color: isSelected
                        ? palette.ctaPlayInk
                        : palette.secondary,
                    }}
                  >
                    {t(item.labelKey)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          <TextField
            label={t("feedback_note_label")}
            placeholder={t("feedback_note_placeholder")}
            value={struggleNote}
            onChangeText={setStruggleNote}
          />

          <Button
            label={t("feedback_save_cta")}
            onPress={() => void handleSaveFeedback()}
            disabled={!selectedMood || saving}
            variant="primary"
          />
        </View>
      ) : (
        <AppText variant="body" tone="success">
          {t("feedback_saved")}
        </AppText>
      )}

      {reminder.isSuccess ? (
        <AppText variant="caption" tone="success" accessibilityLiveRegion="polite">
          {t("return_reminder_scheduled")}
        </AppText>
      ) : (
        <View style={{ gap: space.xs }}>
          <Button
            label={t("return_reminder_cta")}
            variant="secondary"
            loading={reminder.isPending}
            onPress={() => reminder.mutate()}
          />
          {reminder.isError ? (
            <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
              {t("return_reminder_error")}
            </AppText>
          ) : null}
        </View>
      )}

      <Button
        label={t("new_session_cta")}
        onPress={onReset}
        variant="secondary"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  moodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  moodBtn: {
    flex: 1,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
});
