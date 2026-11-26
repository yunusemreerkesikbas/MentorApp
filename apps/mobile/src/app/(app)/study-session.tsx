import { useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { CloseCircleIcon } from "@solar-icons/react-native/linear/close-circle";
import { CheckIcon } from "@solar-icons/react-native/linear/check";
import { PauseIcon } from "@solar-icons/react-native/bold/pause";
import { PlayIcon } from "@solar-icons/react-native/bold/play";
import { SkipNextIcon } from "@solar-icons/react-native/bold/skip-next";
import { DEFAULT_SESSION_PRESETS } from "@mentor/core";
import type { StudyRoomTheme } from "@mentor/types";
import { SessionBuddyCard } from "../../components/session/session-buddy-card.js";
import { SessionDoneView } from "../../components/session/session-done-view.js";
import { SessionRoomsCard } from "../../components/session/session-rooms-card.js";
import { SessionStage, useStageLook } from "../../components/session/session-stage.js";
import { SessionTimerRing } from "../../components/session/session-timer-ring.js";
import { SessionTodayCard } from "../../components/session/session-today-card.js";
import { SessionTopBar } from "../../components/session/session-top-bar.js";
import { useAmbientSound } from "../../components/session/use-ambient-sound.js";
import { useMobileSessionTimer } from "../../components/session/use-mobile-session-timer.js";
import { AppText } from "../../components/ui/index.js";
import { fetchTodayPanel } from "../../lib/coaching-api.js";
import { haptics } from "../../lib/haptics.js";
import { loadSessionResume, loadSessionScene, saveSessionScene } from "../../lib/session-store.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";

export default function StudySessionScreen() {
  const routeParams = useLocalSearchParams<{
    taskId?: string;
    taskTitle?: string;
    subject?: string;
    minutes?: string;
    preset?: string;
    roomId?: string;
  }>();
  // A session still running from an earlier visit wins over the route (web: `readRestorableRecord`).
  const [resume] = useState(loadSessionResume);
  // Only the first session takes the restored (or route) task, room and subject; "Yeni seans" is a plain one.
  const [fresh, setFresh] = useState(false);
  const kept = resume?.record;
  const params: typeof routeParams = fresh ? {}
    : kept ? { ...routeParams, taskId: kept.planTaskId ?? undefined, taskTitle: kept.planTaskTitle ?? undefined, roomId: kept.roomId ?? undefined, subject: kept.subject ?? undefined }
    : routeParams;
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState<string | null>(params.subject?.trim() || null);
  const [scene, setScene] = useState(loadSessionScene);
  const today = useQuery({ queryKey: ["coaching", "today"], queryFn: fetchTodayPanel });
  const streakBaseline = useRef<number | null>(null);

  const timer = useMobileSessionTimer({
    presetParam: params.preset ?? null,
    minutesParam: params.minutes ?? null,
    subject: subject ?? "",
    planTaskId: params.taskId ?? null,
    roomId: params.roomId ?? null,
    planTaskTitle: params.taskTitle ?? null,
    resume,
    onSessionCompleted: () => {
      for (const queryKey of [["coaching", "today"], ["plan-tasks"], ["economy", "quests"], ["study-sessions"]]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
  const ambient = useAmbientSound({ phase: timer.phase, isPaused: timer.isPaused, sceneTheme: scene.theme });

  const changeScene = (next: typeof scene) => {
    setScene(next);
    saveSessionScene(next);
  };

  return (
    <SessionStage phase={timer.phase} theme={scene.plain ? null : scene.theme}>
      <SessionBody
        timer={{ ...timer, reset: () => { setFresh(true); setSubject(null); timer.reset(); } }}
        params={params}
        subject={subject}
        onSubjectChange={setSubject}
        theme={scene.theme}
        plain={scene.plain}
        onThemeChange={(theme) => changeScene({ ...scene, theme })}
        onTogglePlain={() => changeScene({ ...scene, plain: !scene.plain })}
        ambient={ambient}
        today={today}
        onStart={() => {
          streakBaseline.current = today.data?.streak.currentStreak ?? null;
          void timer.start();
        }}
        streakBaseline={streakBaseline.current}
      />
    </SessionStage>
  );
}

function SessionBody({
  timer,
  params,
  subject,
  onSubjectChange,
  theme,
  plain,
  onThemeChange,
  onTogglePlain,
  ambient,
  today,
  onStart,
  streakBaseline,
}: {
  timer: ReturnType<typeof useMobileSessionTimer>;
  params: { taskTitle?: string; roomId?: string };
  subject: string | null;
  onSubjectChange: (subject: string | null) => void;
  theme: StudyRoomTheme;
  plain: boolean;
  onThemeChange: (theme: StudyRoomTheme) => void;
  onTogglePlain: () => void;
  ambient: ReturnType<typeof useAmbientSound>;
  today: ReturnType<typeof useQuery<Awaited<ReturnType<typeof fetchTodayPanel>>>>;
  onStart: () => void;
  streakBaseline: number | null;
}) {
  const t = useTranslations("session");
  const look = useStageLook();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { locale } = useLocale();
  const { availability } = useAppAvailability();
  const running = timer.phase === "focus" || timer.phase === "break";
  const presets = today.data?.sessionPresets?.length ? today.data.sessionPresets : DEFAULT_SESSION_PRESETS;
  const finish = new Date(Date.now() + (timer.focusMinutes + timer.breakMinutes) * 60_000)
    .toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const focusingNow = today.data?.focusingNow ?? 0;

  const back = () => {
    haptics.selection();
    // Back to where the session was opened from: the plan, a room card or the panel.
    if (router.canGoBack()) router.back();
    else router.dismissTo("/(app)/(tabs)/dashboard");
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: 16, gap: 16 }}
    >
      <View style={styles.topRow}>
        {running ? null : (
          <Pressable accessibilityRole="button" accessibilityLabel={t("back_cta")} onPress={back}
            style={[styles.back, { backgroundColor: look.glass, borderColor: look.glassBorder }]}>
            <AltArrowLeftIcon size={22} color={look.ink} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <SessionTopBar subject={subject} onSubjectChange={onSubjectChange} readOnlySubject={timer.phase !== "idle"}
            theme={theme} plain={plain} onThemeChange={onThemeChange} onTogglePlain={onTogglePlain}
            ambient={ambient.preference} onAmbientTrackChange={ambient.setTrackId} onAmbientToggleMute={ambient.toggleMute} />
        </View>
      </View>

      {params.taskTitle && timer.phase !== "done" ? (
        <AppText numberOfLines={2} style={[styles.center, { color: look.inkSoft, fontWeight: "700" }]}>
          {t("from_plan_task", { title: params.taskTitle })}
        </AppText>
      ) : null}
      {today.isError && timer.phase === "idle" ? (
        <AppText variant="caption" style={[styles.center, { color: look.inkSoft }]}>{t("preset_fallback")}</AppText>
      ) : null}

      {timer.phase === "done" ? (
        <SessionDoneView session={timer.session} focusElapsed={timer.focusElapsed} plannedMinutes={timer.focusMinutes}
          subject={subject} planTaskTitle={params.taskTitle ?? null} focusGoal={today.data?.focusGoal ?? null}
          streakBaseline={streakBaseline} theme={theme} onSubmitFeedback={timer.submitFeedback} onReset={timer.reset} />
      ) : (
        <View style={styles.timer}>
          <SessionTimerRing phase={timer.phase} size={Math.min(width - 32, 320)}
            focusMinutes={timer.focusMinutes} breakMinutes={timer.breakMinutes} secondsLeft={timer.secondsLeft}
            isStopwatch={timer.isStopwatch} focusElapsed={timer.focusElapsed}
            presets={presets} selectedPresetId={timer.preset}
            onMinutesChange={timer.setCustomMinutes}
            onPresetSelect={(preset) => timer.selectPreset(preset.id)}
            onStopwatchSelect={() => timer.selectPreset("stopwatch")} />

          {timer.phase === "idle" ? (
            <AppText style={[styles.center, { color: look.inkSoft, fontWeight: "600" }]}>
              {timer.isStopwatch ? t("stopwatch_summary")
                : t("summary_line", { focus: timer.focusMinutes, breakMin: timer.breakMinutes, finish })}
            </AppText>
          ) : null}
          {timer.errorMessage ? <AppText tone="danger" style={styles.center}>{timer.errorMessage}</AppText> : null}

          {timer.phase === "idle" ? (
            <Pressable accessibilityRole="button" disabled={timer.busy} onPress={() => { haptics.selection(); onStart(); }}
              style={[styles.start, { opacity: timer.busy ? 0.6 : 1 }]}>
              <AppText style={styles.startLabel}>{t("control_start")}</AppText>
            </Pressable>
          ) : timer.phase === "focus" ? (
            <View style={styles.controls}>
              <IconControl label={t("control_abandon")} disabled={timer.busy} onPress={() => void timer.finalize("ABANDONED")}>
                <CloseCircleIcon size={26} color={look.inkSoft} />
              </IconControl>
              <IconControl big label={timer.isPaused ? t("control_resume") : t("control_pause")} disabled={timer.busy} onPress={timer.togglePause}>
                {timer.isPaused ? <PlayIcon size={32} color="#0F2233" /> : <PauseIcon size={32} color="#0F2233" />}
              </IconControl>
              <IconControl label={t("control_finish")} disabled={timer.busy} onPress={() => void timer.finalize("COMPLETED")}>
                <CheckIcon size={26} color={look.ink} />
              </IconControl>
            </View>
          ) : (
            <View style={styles.controls}>
              <IconControl big label={t("control_skip_break")} onPress={timer.skipBreak}>
                <SkipNextIcon size={30} color="#0F2233" />
              </IconControl>
            </View>
          )}

          {focusingNow > 1 ? (
            <View style={styles.live}>
              <View style={[styles.dot, { backgroundColor: look.live }]} />
              <AppText variant="caption" style={{ color: look.inkSoft, fontWeight: "700" }}>
                {t("focusing_now", { count: focusingNow })}
              </AppText>
            </View>
          ) : null}
        </View>
      )}

      {running ? null : (
        <>
          <SessionTodayCard focusGoal={today.isError ? null : today.data?.focusGoal} />
          {availability.social ? <SessionBuddyCard /> : null}
          {params.roomId ? null : <SessionRoomsCard />}
        </>
      )}
    </ScrollView>
  );
}

/** The web's icon-only session controls: the label is for screen readers, the shape is the cue. */
function IconControl({ label, big, disabled, onPress, children }: {
  label: string; big?: boolean; disabled?: boolean; onPress: () => void; children: ReactNode;
}) {
  const look = useStageLook();
  const size = big ? 72 : 56;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
      onPress={() => { haptics.selection(); onPress(); }}
      style={[styles.icon, {
        width: size, height: size, borderRadius: size / 2, opacity: disabled ? 0.5 : 1,
        backgroundColor: big ? "#55ACEE" : look.glass, borderColor: big ? "transparent" : look.glassBorder,
      }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  center: { textAlign: "center" },
  timer: { alignItems: "center", gap: 16 },
  start: { minHeight: 56, minWidth: 200, paddingHorizontal: 32, borderRadius: 28, backgroundColor: "#55ACEE", alignItems: "center", justifyContent: "center" },
  startLabel: { color: "#0F2233", fontWeight: "900", fontSize: 18 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 },
  icon: { borderWidth: 1, alignItems: "center", justifyContent: "center" },
  live: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
