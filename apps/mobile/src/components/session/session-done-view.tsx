import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ClockCircleIcon } from "@solar-icons/react-native/linear/clock-circle";
import { FireIcon } from "@solar-icons/react-native/linear/fire";
import { TargetIcon } from "@solar-icons/react-native/linear/target";
import { BookIcon } from "@solar-icons/react-native/linear/book";
import { CheckCircleIcon } from "@solar-icons/react-native/linear/check-circle";
import { formatTimerDisplay } from "@mentor/core";
import { http } from "@mentor/api-client";
import type { FocusGoalDto, SessionReflectionDto, StudyRoomTheme, StudySessionDto } from "@mentor/types";
import { fetchTodayPanel } from "../../lib/coaching-api.js";
import { haptics } from "../../lib/haptics.js";
import { scheduleSessionReturnReminder } from "../../lib/notifications-api.js";
import { useIsPremium } from "../../lib/premium.js";
import { COMPLETION_STAR_TOTAL, sessionStarFill, shareableMinutes } from "../../lib/session-view.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useToast } from "../../providers/toast-provider.js";
import { AppText, Button } from "../ui/index.js";
import { SessionShareSheet } from "./session-share-sheet.js";
import { Stars } from "./session-stars.js";
import { useStageLook } from "./session-stage.js";

const MOODS = [
  { value: 1, emoji: "😩", labelKey: "mood_1" },
  { value: 2, emoji: "😐", labelKey: "mood_2" },
  { value: 3, emoji: "🙂", labelKey: "mood_3" },
] as const;

/** A leaked `<<TASK…` marker never shows as raw text (the web's `sanitizeCoachDisplayText`). */
const DANGLING_MARKER = /<<(TASK|FOLLOWUP|MEMORY)\b[\s\S]*$/i;

/**
 * The web's `SessionDoneState` in a `CompletionSummary`: stars, title, streak line, stats,
 * the mood check-in, then a new session, the share card and a reminder for tomorrow.
 */
export function SessionDoneView({
  session,
  focusElapsed,
  plannedMinutes,
  subject,
  planTaskTitle,
  focusGoal,
  streakBaseline,
  theme,
  onSubmitFeedback,
  onReset,
}: {
  session: StudySessionDto | null;
  focusElapsed: number;
  plannedMinutes: number;
  subject: string | null;
  planTaskTitle: string | null;
  focusGoal: FocusGoalDto | null;
  streakBaseline: number | null;
  theme: StudyRoomTheme;
  onSubmitFeedback: (mood: number, note?: string) => Promise<void>;
  onReset: () => void;
}) {
  const t = useTranslations("session");
  const look = useStageLook();
  const router = useRouter();
  const toast = useToast();
  const premium = useIsPremium();
  const { availability } = useAppAvailability();
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [reflection, setReflection] = useState<string | null>(null);
  const [reflecting, setReflecting] = useState(false);
  const [remind, setRemind] = useState<"idle" | "saving" | "done">("idle");
  const [shareOpen, setShareOpen] = useState(false);
  const today = useQuery({ queryKey: ["coaching", "today"], queryFn: fetchTodayPanel });
  const streak = today.data?.streak.currentStreak ?? null;

  const counts = session?.countsAsFocusSession ?? true;
  const abandoned = session?.status === "ABANDONED";
  const filled = sessionStarFill({ elapsedSec: focusElapsed, plannedSec: plannedMinutes * 60, countsAsFocusSession: counts, abandoned });
  const shareMinutes = shareableMinutes(focusElapsed, counts);
  const statusLine = !counts && !abandoned ? t("too_short_hint")
    : streak != null && streakBaseline != null && streakBaseline === 0 && streak >= 1 ? t("streak_started")
    : streak != null && streakBaseline != null && streak > streakBaseline ? t("streak_kept", { days: streak })
    : null;

  useEffect(() => {
    if (filled >= COMPLETION_STAR_TOTAL) haptics.success();
  }, [filled]);

  const goal = today.data?.focusGoal ?? focusGoal;
  const stats: { id: string; icon: ReactNode; label: string; value: string }[] = [
    { id: "time", icon: <ClockCircleIcon size={18} color={look.progress} />, label: t("stat_time"), value: formatTimerDisplay(focusElapsed) },
    ...(streak != null ? [{ id: "streak", icon: <FireIcon size={18} color={look.progress} />, label: t("stat_streak"), value: String(streak) }] : []),
    ...(goal?.goalMinutes != null
      ? [{ id: "goal", icon: <TargetIcon size={18} color={look.progress} />, label: t("stat_goal"), value: t("goal_progress", { done: goal.focusMinutesToday, goal: goal.goalMinutes }) }]
      : subject
        ? [{ id: "subject", icon: <BookIcon size={18} color={look.progress} />, label: t("stat_subject"), value: subject }]
        : session?.planTaskAutoCompleted
          ? [{ id: "plan", icon: <CheckCircleIcon size={18} color={look.progress} />, label: t("stat_plan_task"), value: planTaskTitle ?? t("history_completed") }]
          : []),
  ];

  const save = async () => {
    if (mood == null || status === "saving") return;
    setStatus("saving");
    try {
      await onSubmitFeedback(mood, note.trim() || undefined);
      setStatus("saved");
      // Puhu's reflection is a Premium extra; a free account sees nothing here (no sales on mobile).
      if (session && premium && availability.aiCoach) {
        setReflecting(true);
        http<SessionReflectionDto>("/v1/coach/session-reflection", { method: "POST", body: JSON.stringify({ sessionId: session.id }) })
          .then((res) => setReflection((res as SessionReflectionDto).reflection.replace(DANGLING_MARKER, "").trimEnd() || null))
          .catch(() => {})
          .finally(() => setReflecting(false));
      }
    } catch {
      setStatus("idle");
    }
  };

  const remindTomorrow = async () => {
    if (remind !== "idle") return;
    setRemind("saving");
    try {
      const res = await scheduleSessionReturnReminder(subject);
      setRemind("done");
      haptics.success();
      toast.show(res.alreadyScheduled ? t("return_remind_already_message") : t("return_remind_ok_message"));
    } catch {
      setRemind("idle");
      toast.show(t("return_remind_error_title"));
    }
  };

  const ink = { color: look.ink };
  const soft = { color: look.inkSoft };

  return (
    <View style={[styles.card, { backgroundColor: look.card, borderColor: look.glassBorder }]}>
      <Stars filled={filled} label={t("stars_label", { filled: String(filled).replace(".", ","), total: COMPLETION_STAR_TOTAL })} />
      <AppText accessibilityRole="header" variant="title" style={[ink, styles.center]}>{t("done_title")}</AppText>
      {statusLine ? <AppText accessibilityLiveRegion="polite" style={[soft, styles.center]}>{statusLine}</AppText> : null}

      <View style={styles.stats}>
        {stats.map((stat) => (
          <View key={stat.id} style={[styles.stat, { borderColor: look.glassBorder }]}>
            {stat.icon}
            <AppText style={[soft, styles.statLabel]}>{stat.label}</AppText>
            <AppText tabularNums numberOfLines={1} style={[ink, styles.statValue]}>{stat.value}</AppText>
          </View>
        ))}
      </View>

      {status === "saved" ? (
        <View style={styles.block}>
          <AppText accessibilityLiveRegion="polite" style={[ink, styles.center, styles.bold]}>{t("checkin_saved")}</AppText>
          {mood === 1 && session ? (
            <Pressable accessibilityRole="link"
              onPress={() => router.push({ pathname: "/(app)/(tabs)/plan", params: { coach: "adapt", source: "session", sessionId: session.id } } as never)}
              style={[styles.outline, { borderColor: look.glassBorder }]}>
              <AppText style={[ink, styles.bold, styles.center]}>{t("coach_adaptation_cta")}</AppText>
            </Pressable>
          ) : null}
          {reflecting ? <AppText style={[soft, styles.center]}>{t("reflection_loading")}</AppText> : null}
          {reflection ? (
            <View style={[styles.outline, { borderColor: look.glassBorder, alignItems: "flex-start" }]}>
              <AppText style={ink}>{reflection}</AppText>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.block}>
          <AppText style={[ink, styles.center, styles.bold]}>{t("checkin_title")}</AppText>
          <View style={styles.moods}>
            {MOODS.map((m) => {
              const selected = mood === m.value;
              return (
                <Pressable key={m.value} accessibilityRole="radio" accessibilityLabel={t(m.labelKey)} accessibilityState={{ selected }}
                  onPress={() => { haptics.selection(); setMood(m.value); }} style={styles.moodCell}>
                  <View style={[styles.mood, { borderColor: selected ? look.ink : look.track, backgroundColor: look.glass }]}>
                    <AppText style={styles.emoji}>{m.emoji}</AppText>
                  </View>
                  <AppText variant="caption" style={[selected ? ink : soft, styles.bold]}>{t(m.labelKey)}</AppText>
                </Pressable>
              );
            })}
          </View>
          {mood != null ? (
            <>
              <TextInput value={note} onChangeText={setNote} maxLength={280}
                placeholder={subject ? t("checkin_note_subject", { subject }) : t("checkin_note_placeholder")}
                placeholderTextColor={look.inkSoft}
                style={[styles.input, { borderColor: look.track, color: look.ink, backgroundColor: look.glass }]} />
              <Button label={t("checkin_save")} loading={status === "saving"} onPress={() => void save()} />
            </>
          ) : null}
        </View>
      )}

      <View style={styles.block}>
        <Button label={t("new_session")} onPress={onReset} />
        {shareMinutes ? <Button label={t("share_cta")} variant="secondary" onPress={() => setShareOpen(true)} /> : null}
        <Pressable accessibilityRole="button" disabled={remind !== "idle"} onPress={() => void remindTomorrow()} style={styles.remind}>
          <AppText style={[ink, styles.bold, remind === "saving" && { opacity: 0.6 }]}>
            {remind === "done" ? t("return_remind_done") : t("return_remind_cta")}
          </AppText>
        </Pressable>
      </View>

      {shareOpen && shareMinutes ? (
        <SessionShareSheet sessionId={session?.id ?? null} minutes={shareMinutes} subject={subject} stars={filled}
          theme={theme} endedAt={session?.endedAt ? new Date(session.endedAt) : new Date()} onClose={() => setShareOpen(false)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16, padding: 20, borderRadius: 20, borderWidth: 1, alignItems: "stretch" },
  center: { textAlign: "center" },
  bold: { fontWeight: "700" },
  stats: { gap: 8 },
  stat: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  statLabel: { flex: 1, fontWeight: "600" },
  statValue: { fontWeight: "800", maxWidth: "55%" },
  block: { gap: 12 },
  moods: { flexDirection: "row", justifyContent: "center", gap: 16 },
  moodCell: { alignItems: "center", gap: 4, minWidth: 64 },
  mood: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 22, lineHeight: 28 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 15 },
  outline: { minHeight: 44, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center", justifyContent: "center" },
  remind: { minHeight: 44, alignItems: "center", justifyContent: "center" },
});
