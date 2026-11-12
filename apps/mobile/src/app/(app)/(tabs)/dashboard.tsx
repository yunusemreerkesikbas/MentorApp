import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiClientError } from "@mentor/api-client";
import type { PlanTaskDto, PlanTaskStatus, WeeklyChestView } from "@mentor/types";
import { CountdownCard, GoalCard, JourneyCard } from "../../../components/panel/info-cards.js";
import { MoodRow } from "../../../components/panel/mood-row.js";
import { PanelSkeleton } from "../../../components/panel/panel-skeleton.js";
import { PLAY_RADIUS } from "../../../components/panel/primitives.js";
import { QuestsCard } from "../../../components/panel/quests-card.js";
import { QuestsSheet, type QuestDestination } from "../../../components/panel/quests-sheet.js";
import { StreakRescueSheet } from "../../../components/panel/streak-rescue-sheet.js";
import { chestReward } from "../../../components/panel/today-path.js";
import { TodayPathCard } from "../../../components/panel/today-path-card.js";
import { AppText, StateView } from "../../../components/ui/index.js";
import {
  fetchDailyQuests,
  fetchEconomyBalance,
  fetchStreakRescue,
  fetchTodayPanel,
  fetchVision,
  fetchWeeklyChest,
  openWeeklyChest,
  updatePlanTask,
} from "../../../lib/coaching-api.js";
import { haptics } from "../../../lib/haptics.js";
import { cardShadow, tabBarClearance } from "../../../lib/layout.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

const TOAST_MS = 2600;

/**
 * Panel, the "Bugün" hub (the web's `PanelShell` at phone width): mood, today's path, daily
 * quests, the countdown, the goal and the journey. The screen orchestrates; the cards render.
 */
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { palette } = useThemeTokens();
  const t = useTranslations("panel");
  const tCommon = useTranslations("common");
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [questsOpen, setQuestsOpen] = useState(false);

  const todayQuery = useQuery({ queryKey: ["coaching", "today"], queryFn: fetchTodayPanel });
  const questsQuery = useQuery({ queryKey: ["economy", "quests"], queryFn: fetchDailyQuests });
  const chestQuery = useQuery({ queryKey: ["economy", "weekly-chest"], queryFn: fetchWeeklyChest });
  const balanceQuery = useQuery({ queryKey: ["economy", "balance"], queryFn: fetchEconomyBalance });
  const visionQuery = useQuery({ queryKey: ["coaching", "vision"], queryFn: fetchVision });
  const rescueQuery = useQuery({
    queryKey: ["economy", "streak-rescue"],
    queryFn: fetchStreakRescue,
  });

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["coaching", "today"] }),
      queryClient.invalidateQueries({ queryKey: ["economy"] }),
      queryClient.invalidateQueries({ queryKey: ["coaching", "vision"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread"] }),
    ]);
  };

  const failToast = (error: unknown) =>
    setToast(error instanceof ApiClientError ? error.message : tCommon("error_body"));

  const setTaskStatus = async (task: PlanTaskDto, status: PlanTaskStatus) => {
    setBusyTaskId(task.id);
    try {
      await updatePlanTask(task.id, { status });
      if (status === "DONE") {
        haptics.success();
        setToast(t("task_done_toast"));
      }
      await refreshAll();
    } catch (error) {
      failToast(error);
    } finally {
      setBusyTaskId(null);
    }
  };

  const startSession = (task?: PlanTaskDto) => {
    const params: Record<string, string> = {};
    if (task) {
      params.taskId = task.id;
      params.taskTitle = task.title;
      if (task.subject) params.subject = task.subject;
      const focusMinutes = task.sessionFocusMinutes ?? task.durationMinutes;
      if (focusMinutes) params.minutes = String(focusMinutes);
    }
    router.push({ pathname: "/(app)/study-session" as never, params });
  };

  const openPlan = () => router.replace("/plan" as never);

  const goFromQuest = (destination: QuestDestination) => {
    if (destination === "plan") openPlan();
    else if (destination === "study-session") startSession();
    else router.replace("/settings" as never);
  };

  // The opening scene comes with the reward stop; until then a ready chest opens with a toast.
  const openChest = async (chest: WeeklyChestView) => {
    if (chest.state !== "READY") return;
    try {
      const opened = await openWeeklyChest(chest.periodKey);
      haptics.success();
      const reward = chestReward(opened, t);
      setToast(reward ? t("chest_opened_toast", { reward }) : t("chest_card_opened_title"));
      await refreshAll();
    } catch (error) {
      failToast(error);
    }
  };

  const panel = todayQuery.data;
  const balance = balanceQuery.data ?? null;

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScrollView
        style={styles.screen}
        refreshControl={
          <RefreshControl
            refreshing={todayQuery.isRefetching}
            onRefresh={() => void refreshAll()}
            tintColor={palette.accent}
          />
        }
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarClearance(insets.bottom) },
        ]}
      >
        {todayQuery.isLoading ? (
          <PanelSkeleton />
        ) : todayQuery.isError || !panel ? (
          <StateView
            title={tCommon("error_title")}
            body={tCommon("error_body")}
            actionLabel={t("retry")}
            onAction={() => void todayQuery.refetch()}
            tone="error"
          />
        ) : (
          <>
            <MoodRow
              initial={panel.mood}
              canLighten={panel.canLightenPlan}
              onSaved={() => void refreshAll()}
              onLighten={openPlan}
            />
            <TodayPathCard
              data={panel}
              chest={chestQuery.data ?? null}
              busyTaskId={busyTaskId}
              onSetStatus={(task, status) => void setTaskStatus(task, status)}
              onStartSession={startSession}
              onChestPress={(chest) => void openChest(chest)}
              onOpenPlan={openPlan}
            />
            <QuestsCard
              quests={questsQuery.data ?? []}
              chest={chestQuery.data ?? null}
              onChestPress={(chest) => void openChest(chest)}
              onOpenAll={() => setQuestsOpen(true)}
            />
            {panel.countdown ? (
              <CountdownCard
                countdown={panel.countdown}
                onPress={() => router.push("/(app)/knowledge" as never)}
              />
            ) : null}
            <GoalCard vision={visionQuery.data ?? null} />
            {balance ? (
              <JourneyCard level={balance.level} freezeTokens={panel.streak.freezeTokens} />
            ) : null}
          </>
        )}
      </ScrollView>

      <QuestsSheet
        visible={questsOpen}
        quests={questsQuery.data ?? []}
        onClose={() => setQuestsOpen(false)}
        onGo={goFromQuest}
      />
      <StreakRescueSheet
        offer={rescueQuery.data ?? null}
        onRescued={() => {
          setToast(t("rescue_done_toast"));
          void refreshAll();
        }}
        onOpenQuests={() => setQuestsOpen(true)}
        onError={(message) => setToast(message ?? tCommon("error_body"))}
      />

      {toast ? (
        <View
          accessibilityLiveRegion="polite"
          pointerEvents="none"
          style={[
            styles.toast,
            cardShadow,
            {
              bottom: tabBarClearance(insets.bottom) - 4,
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}
        >
          <AppText style={styles.toastText}>{toast}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 20,
    gap: 20,
  },
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    borderWidth: 1,
    borderRadius: PLAY_RADIUS,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toastText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
});
