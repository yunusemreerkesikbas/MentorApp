import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { firstName, greetingKeyForHour } from "@mentor/core";
import { ExamType, type PlanTaskDto, type PlanTaskStatus } from "@mentor/types";
import { EconomyQuestsCard } from "../../../components/dashboard/economy-quests-card.js";
import { MoodCheckinCard } from "../../../components/dashboard/mood-checkin-card.js";
import { StreakAndCountdownRow } from "../../../components/dashboard/streak-and-countdown-row.js";
import { TodayTasksCard } from "../../../components/dashboard/today-tasks-card.js";
import { WeeklyRitualAndVisionCard } from "../../../components/dashboard/weekly-ritual-and-vision-card.js";
import {
  AppText,
  Chip,
  ScreenLoadingSkeleton,
  StateView,
} from "../../../components/ui/index.js";
import {
  fetchDailyQuests,
  fetchEconomyBalance,
  fetchStreakRescue,
  fetchTodayPanel,
  updatePlanTask,
} from "../../../lib/coaching-api.js";
import { haptics } from "../../../lib/haptics.js";
import { useAuth } from "../../../providers/auth-provider.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const todayQuery = useQuery({
    queryKey: ["coaching", "today"],
    queryFn: fetchTodayPanel,
  });

  const balanceQuery = useQuery({
    queryKey: ["economy", "balance"],
    queryFn: fetchEconomyBalance,
  });

  const questsQuery = useQuery({
    queryKey: ["economy", "quests"],
    queryFn: fetchDailyQuests,
  });

  const streakRescueQuery = useQuery({
    queryKey: ["economy", "streak-rescue"],
    queryFn: fetchStreakRescue,
  });

  const greetingKey = greetingKeyForHour();
  const displayFirstName = firstName(
    todayQuery.data?.greetingName ?? user?.displayName ?? t("default_name"),
  );
  const examType = user?.examType ?? ExamType.YKS;

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["coaching", "today"] }),
      queryClient.invalidateQueries({ queryKey: ["economy", "balance"] }),
      queryClient.invalidateQueries({ queryKey: ["economy", "quests"] }),
      queryClient.invalidateQueries({ queryKey: ["economy", "streak-rescue"] }),
      queryClient.invalidateQueries({ queryKey: ["economy", "weekly-chest"] }),
      queryClient.invalidateQueries({ queryKey: ["coaching", "vision"] }),
    ]);
  };

  const handleToggleTask = async (
    task: PlanTaskDto,
    nextStatus: PlanTaskStatus,
  ) => {
    setBusyTaskId(task.id);
    try {
      await updatePlanTask(task.id, { status: nextStatus });
      if (nextStatus === "DONE") {
        haptics.success();
      }
      await refreshAll();
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleStartSession = (task?: PlanTaskDto) => {
    const params: Record<string, string> = {};
    if (task) {
      params.taskId = task.id;
      params.taskTitle = task.title;
      if (task.subject) params.subject = task.subject;
      const focusMin = task.sessionFocusMinutes ?? task.durationMinutes;
      if (focusMin) params.minutes = String(focusMin);
    }
    router.push({
      pathname: "/(app)/study-session" as never,
      params,
    });
  };

  const panel = todayQuery.data;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: palette.bg }}
      refreshControl={
        <RefreshControl
          refreshing={todayQuery.isRefetching}
          onRefresh={() => void refreshAll()}
          tintColor={palette.accent}
        />
      }
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingBottom: space.xl,
        paddingHorizontal: space.lg,
        gap: space.lg,
      }}
    >
      {/* Header Greeting Row */}
      <View style={styles.headerRow}>
        <View style={{ gap: space.xs, flex: 1 }}>
          <AppText variant="title">
            {t(greetingKey, { name: displayFirstName })}
          </AppText>
          <AppText variant="body" tone="secondary">
            {panel?.motivationalLine ?? t("ritual_body")}
          </AppText>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Chip
            label={`${t("exam_badge_prefix")} ${examType}`}
            onPress={() => router.push("/(app)/knowledge" as never)}
          />
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Chip
              label={t("knowledge_cta")}
              onPress={() => router.push("/(app)/knowledge" as never)}
            />
            <Chip
              label={t("notifications_cta")}
              onPress={() => router.push("/(app)/notifications" as never)}
            />
          </View>
        </View>
      </View>

      {todayQuery.isLoading ? (
        <ScreenLoadingSkeleton />
      ) : todayQuery.isError || !panel ? (
        <StateView
          title={tCommon("error_title")}
          body={tCommon("error_body")}
          actionLabel={tCommon("retry")}
          onAction={() => void todayQuery.refetch()}
          tone="error"
        />
      ) : (
        <>
          <MoodCheckinCard
            initialMood={panel.mood}
            onSaved={() => void refreshAll()}
          />

          <StreakAndCountdownRow
            streak={panel.streak}
            countdown={panel.countdown}
            streakRescue={streakRescueQuery.data ?? null}
            onRescueCompleted={() => void refreshAll()}
          />

          <TodayTasksCard
            nextAction={panel.nextAction}
            tasks={panel.tasks}
            focusGoal={panel.focusGoal}
            focusingNow={panel.focusingNow}
            busyTaskId={busyTaskId}
            onToggleTask={(task, status) => void handleToggleTask(task, status)}
            onStartSessionForTask={handleStartSession}
            onOpenPlan={() => router.push("/(app)/(tabs)/plan" as never)}
          />

          <EconomyQuestsCard
            balance={balanceQuery.data ?? null}
            quests={questsQuery.data ?? []}
          />

          <WeeklyRitualAndVisionCard />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
});
