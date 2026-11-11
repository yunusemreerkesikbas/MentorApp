import { Pressable, StyleSheet, View } from "react-native";
import { taskStats } from "@mentor/core";
import type {
  DailyNextActionDto,
  FocusGoalDto,
  PlanTaskDto,
  PlanTaskStatus,
} from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, Chip, StateView } from "../ui/index.js";

export interface TodayTasksCardProps {
  nextAction: DailyNextActionDto;
  tasks: PlanTaskDto[];
  focusGoal: FocusGoalDto;
  focusingNow: number | null;
  busyTaskId: string | null;
  onToggleTask: (task: PlanTaskDto, nextStatus: PlanTaskStatus) => void;
  onStartSessionForTask: (task?: PlanTaskDto) => void;
  onOpenPlan: () => void;
}

export function TodayTasksCard({
  nextAction,
  tasks,
  focusGoal,
  focusingNow,
  busyTaskId,
  onToggleTask,
  onStartSessionForTask,
  onOpenPlan,
}: TodayTasksCardProps) {
  const t = useTranslations("dashboard");
  const tSession = useTranslations("session");
  const { palette, radii, space, touchTargets } = useThemeTokens();
  const stats = taskStats(tasks);
  const highlightedTask =
    (nextAction.taskId ? tasks.find((item) => item.id === nextAction.taskId) : undefined) ??
    tasks.find((item) => item.status === "PENDING");

  return (
    <View style={{ gap: space.md }}>
      {/* Next Action Hero Card */}
      <Card style={{ gap: space.md }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="caption" tone="accent">
              {t("ritual_title")}
            </AppText>
            <AppText variant="sectionHeading">{nextAction.title}</AppText>
          </View>
          {focusingNow != null && focusingNow > 0 ? (
            <Chip
              label={tSession("focusing_now", { count: focusingNow })}
              tone="success"
            />
          ) : null}
        </View>

        <AppText variant="body" tone="secondary">
          {nextAction.message}
        </AppText>

        {focusGoal.focusMinutesToday > 0 || focusGoal.goalMinutes != null ? (
          <AppText variant="caption" tone="muted" tabularNums>
            {focusGoal.goalMinutes != null
              ? `${focusGoal.focusMinutesToday} / ${focusGoal.goalMinutes} dk`
              : `${focusGoal.focusMinutesToday} dk`}
          </AppText>
        ) : null}

        <View style={styles.ctaRow}>
          <View style={{ flex: 1 }}>
            <Button
              label={t("start_session_cta")}
              onPress={() => onStartSessionForTask(highlightedTask)}
              variant="primary"
            />
          </View>
          <Button
            label={t("open_plan_cta")}
            onPress={onOpenPlan}
            variant="secondary"
          />
        </View>
      </Card>

      {/* Today's Tasks List */}
      {tasks.length === 0 ? (
        <StateView
          title={t("empty_plan_title")}
          body={t("empty_plan_body")}
          actionLabel={t("open_plan_cta")}
          onAction={onOpenPlan}
          tone="empty"
        />
      ) : (
        <Card style={{ gap: space.md }}>
          <View style={styles.headerRow}>
            <AppText variant="cardTitle">{t("tasks_title")}</AppText>
            <Chip
              label={t("tasks_progress", {
                done: stats.done,
                total: stats.total,
              })}
              tone={stats.done === stats.total ? "success" : "default"}
            />
          </View>

          <View style={{ gap: space.sm }}>
            {tasks.map((task) => {
              const isDone = task.status === "DONE";
              const isBusy = busyTaskId === task.id;
              const minutes = task.sessionFocusMinutes ?? task.durationMinutes;

              return (
                <View
                  key={task.id}
                  style={[
                    styles.taskRow,
                    {
                      backgroundColor: isDone ? palette.surfaceAlt : palette.surface,
                      borderColor: palette.border,
                      borderRadius: radii.inner,
                      padding: space.md,
                      opacity: isBusy ? 0.6 : 1,
                    },
                  ]}
                >
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isDone, disabled: isBusy }}
                    disabled={isBusy}
                    hitSlop={8}
                    onPress={() => {
                      haptics.selection();
                      onToggleTask(task, isDone ? "PENDING" : "DONE");
                    }}
                    style={[
                      styles.checkboxHit,
                      { minHeight: touchTargets.min, minWidth: touchTargets.min },
                    ]}
                  >
                    <View
                      style={[
                        styles.checkboxBox,
                        {
                          borderRadius: radii.pill,
                          borderColor: isDone ? palette.success : palette.border,
                          backgroundColor: isDone ? palette.success : "transparent",
                        },
                      ]}
                    >
                      {isDone ? (
                        <AppText variant="micro" style={{ color: "#FFFFFF" }}>
                          ✓
                        </AppText>
                      ) : null}
                    </View>
                  </Pressable>

                  <View style={{ flex: 1, gap: 4 }}>
                    <AppText
                      variant="body"
                      tone={isDone ? "muted" : "main"}
                      style={
                        isDone ? { textDecorationLine: "line-through" } : undefined
                      }
                    >
                      {task.title}
                    </AppText>
                    <View style={styles.metaRow}>
                      {task.subject ? (
                        <AppText variant="micro" tone="secondary">
                          {task.subject}
                          {task.topic ? ` · ${task.topic}` : ""}
                        </AppText>
                      ) : null}
                      {minutes ? (
                        <AppText variant="micro" tone="muted" tabularNums>
                          {tSession("recent_item", { minutes })}
                        </AppText>
                      ) : null}
                    </View>
                  </View>

                  {!isDone ? (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={6}
                      onPress={() => {
                        haptics.selection();
                        onStartSessionForTask(task);
                      }}
                      style={[
                        styles.focusButton,
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
                        {t("focus_task_cta")}
                      </AppText>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    gap: 8,
  },
  checkboxHit: {
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  focusButton: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
