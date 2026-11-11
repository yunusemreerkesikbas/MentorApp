import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { shiftDate, todayIso, weekStart } from "@mentor/core";
import type { PlanTaskDto, PlanTaskStatus } from "@mentor/types";
import { PlanTaskComposer } from "../../../components/plan/plan-task-composer.js";
import { PlanTaskList } from "../../../components/plan/plan-task-list.js";
import { PuhuPlanAdaptCard } from "../../../components/plan/puhu-plan-adapt-card.js";
import { WeekStrip } from "../../../components/plan/week-strip.js";
import {
  AppText,
  ScreenLoadingSkeleton,
  StateView,
} from "../../../components/ui/index.js";
import {
  deletePlanTask,
  listPlanTasksForWeek,
  updatePlanTask,
} from "../../../lib/coaching-api.js";
import { haptics } from "../../../lib/haptics.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");

  const [selectedDate, setSelectedDate] = useState<string>(() => todayIso());
  const [weekAnchor, setWeekAnchor] = useState<string>(() =>
    weekStart(todayIso()),
  );
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const weekQuery = useQuery({
    queryKey: ["plan-tasks", "week", weekAnchor],
    queryFn: () => listPlanTasksForWeek(weekAnchor),
  });

  const invalidatePlanAndToday = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["plan-tasks", "week", weekAnchor],
      }),
      queryClient.invalidateQueries({ queryKey: ["coaching", "today"] }),
      queryClient.invalidateQueries({ queryKey: ["economy", "quests"] }),
    ]);
  };

  const handleSelectDate = (iso: string) => {
    setSelectedDate(iso);
    const nextAnchor = weekStart(iso);
    if (nextAnchor !== weekAnchor) {
      setWeekAnchor(nextAnchor);
    }
  };

  const handleShiftWeek = (deltaWeeks: -1 | 1) => {
    const nextAnchor = shiftDate(weekAnchor, deltaWeeks * 7);
    const nextSelected = shiftDate(selectedDate, deltaWeeks * 7);
    setWeekAnchor(nextAnchor);
    setSelectedDate(nextSelected);
  };

  const handleJumpToday = () => {
    const today = todayIso();
    setSelectedDate(today);
    setWeekAnchor(weekStart(today));
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
      await invalidatePlanAndToday();
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleDeleteTask = async (task: PlanTaskDto) => {
    setBusyTaskId(task.id);
    try {
      await deletePlanTask(task.id);
      await invalidatePlanAndToday();
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleStartSession = (task: PlanTaskDto) => {
    const params: Record<string, string> = {
      taskId: task.id,
      taskTitle: task.title,
    };
    if (task.subject) params.subject = task.subject;
    const focusMin = task.sessionFocusMinutes ?? task.durationMinutes;
    if (focusMin) params.minutes = String(focusMin);
    router.push({
      pathname: "/(app)/study-session" as never,
      params,
    });
  };

  const weekTasks = weekQuery.data ?? {};
  const dayTasks = weekTasks[selectedDate] ?? [];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: palette.bg }}
      refreshControl={
        <RefreshControl
          refreshing={weekQuery.isRefetching}
          onRefresh={() => void invalidatePlanAndToday()}
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
      <View style={{ gap: space.xs }}>
        <AppText variant="title">{t("title")}</AppText>
        <AppText variant="body" tone="secondary">
          {t("subtitle")}
        </AppText>
      </View>

      <WeekStrip
        weekAnchor={weekAnchor}
        selectedDate={selectedDate}
        weekTasks={weekTasks}
        onSelectDate={handleSelectDate}
        onShiftWeek={handleShiftWeek}
        onJumpToday={handleJumpToday}
      />

      <PuhuPlanAdaptCard onApplied={() => void invalidatePlanAndToday()} />

      <PlanTaskComposer
        selectedDate={selectedDate}
        onTaskCreated={() => void invalidatePlanAndToday()}
      />

      {weekQuery.isLoading ? (
        <ScreenLoadingSkeleton />
      ) : weekQuery.isError ? (
        <StateView
          title={tCommon("error_title")}
          body={tCommon("error_body")}
          actionLabel={tCommon("retry")}
          onAction={() => void weekQuery.refetch()}
          tone="error"
        />
      ) : (
        <PlanTaskList
          selectedDate={selectedDate}
          tasks={dayTasks}
          busyTaskId={busyTaskId}
          onToggleTask={(task, status) => void handleToggleTask(task, status)}
          onDeleteTask={(task) => void handleDeleteTask(task)}
          onStartSession={handleStartSession}
        />
      )}
    </ScrollView>
  );
}
