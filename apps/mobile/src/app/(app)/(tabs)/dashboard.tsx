import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiClientError } from "@mentor/api-client";
import { isPremiumFeatureAvailable } from "@mentor/core";
import type { PlanTaskDto, PlanTaskStatus, WeeklyChestView } from "@mentor/types";
import { ChestScene } from "../../../components/celebrations/chest-scene.js";
import { CountdownCard, GoalCard, JourneyCard } from "../../../components/panel/info-cards.js";
import { MoodRow } from "../../../components/panel/mood-row.js";
import { PanelSkeleton } from "../../../components/panel/panel-skeleton.js";
import { QuestsCard } from "../../../components/panel/quests-card.js";
import { QuestsSheet, type QuestDestination } from "../../../components/panel/quests-sheet.js";
import { StreakRescueSheet } from "../../../components/panel/streak-rescue-sheet.js";
import { TodayPathCard } from "../../../components/panel/today-path-card.js";
import { RecapTeaserCard } from "../../../components/recap/recap-teaser-card.js";
import { StateView } from "../../../components/ui/index.js";
import {
  fetchDailyQuests,
  fetchEconomyBalance,
  fetchStreakRescue,
  fetchTodayPanel,
  fetchVision,
  fetchWeeklyChest,
  updatePlanTask,
} from "../../../lib/coaching-api.js";
import { haptics } from "../../../lib/haptics.js";
import { tabBarClearance } from "../../../lib/layout.js";
import { useSubscriptionView } from "../../../lib/premium.js";
import { useCelebrations } from "../../../providers/celebration-provider.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useToast } from "../../../providers/toast-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

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
  const toast = useToast();
  const celebrations = useCelebrations();
  const setToast = toast.show;
  const [questsOpen, setQuestsOpen] = useState(false);
  const [chestScene, setChestScene] = useState<WeeklyChestView | null>(null);

  const todayQuery = useQuery({ queryKey: ["coaching", "today"], queryFn: fetchTodayPanel });
  const questsQuery = useQuery({ queryKey: ["economy", "quests"], queryFn: fetchDailyQuests });
  const chestQuery = useQuery({ queryKey: ["economy", "weekly-chest"], queryFn: fetchWeeklyChest });
  const balanceQuery = useQuery({ queryKey: ["economy", "balance"], queryFn: fetchEconomyBalance });
  const visionQuery = useQuery({ queryKey: ["coaching", "vision"], queryFn: fetchVision });
  const rescueQuery = useQuery({
    queryKey: ["economy", "streak-rescue"],
    queryFn: fetchStreakRescue,
  });

  const refreshAll = async () => {
    // Anything refreshed here may have earned something: ask for unseen rewards too.
    celebrations.refresh();
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
  const subscriptionView = useSubscriptionView();
  // Puhu lightens the day for whoever has it; everyone else lands on the plan as before.
  const lightenToday = () =>
    isPremiumFeatureAvailable(subscriptionView, "plan.ai")
      ? router.replace({ pathname: "/plan" as never, params: { coach: "adapt", source: "mood" } })
      : openPlan();

  const goFromQuest = (destination: QuestDestination) => {
    if (destination === "plan") openPlan();
    else if (destination === "study-session") startSession();
    else router.replace("/settings" as never);
  };

  // A ready chest opens in its scene; an opened one shows the week's note again.
  // ponytail: a chest still filling does nothing yet; the web's info sheet comes with the recap stop.
  const openChest = (chest: WeeklyChestView) => {
    if (chest.state !== "PROGRESS") setChestScene(chest);
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
              onLighten={lightenToday}
            />
            <TodayPathCard
              data={panel}
              chest={chestQuery.data ?? null}
              busyTaskId={busyTaskId}
              onSetStatus={(task, status) => void setTaskStatus(task, status)}
              onStartSession={startSession}
              onChestPress={openChest}
              onOpenPlan={openPlan}
            />
            <QuestsCard
              quests={questsQuery.data ?? []}
              chest={chestQuery.data ?? null}
              onChestPress={openChest}
              onOpenAll={() => setQuestsOpen(true)}
            />
            {panel.countdown ? (
              <CountdownCard
                countdown={panel.countdown}
                onPress={() => router.push("/(app)/knowledge" as never)}
              />
            ) : null}
            {/* Owner, 2026-11-13: only a READY week; the access policy refuses PARTIAL ones. */}
            {panel.weeklyRecapPeriod?.status === "READY" ? (
              <RecapTeaserCard
                period={panel.weeklyRecapPeriod}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/weekly-recap" as never,
                    params: {
                      examId: panel.weeklyRecapPeriod!.examId,
                      weekStart: panel.weeklyRecapPeriod!.startDate,
                    },
                  })
                }
              />
            ) : null}
            <GoalCard vision={visionQuery.data ?? null} onOpenGoal={() => router.push("/(app)/vision-board")}
              onOpenBoard={() => router.push("/(app)/vision-board/board")} onOpenDesk={() => router.push("/(app)/notebooks")} />
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
        offer={celebrations.active ? null : (rescueQuery.data ?? null)}
        onRescued={() => {
          setToast(t("rescue_done_toast"));
          void refreshAll();
        }}
        onOpenQuests={() => setQuestsOpen(true)}
        onError={(message) => setToast(message ?? tCommon("error_body"))}
      />
      {chestScene ? (
        <ChestScene
          chest={chestScene}
          onClose={(opened) => {
            setChestScene(null);
            if (opened) void refreshAll();
          }}
        />
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
});
