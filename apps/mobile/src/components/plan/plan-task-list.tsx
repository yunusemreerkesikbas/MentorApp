import { Pressable, StyleSheet, View } from "react-native";
import { formatDateLabel, formatTimeRange, isPastDate, taskStats } from "@mentor/core";
import type { PlanTaskDto, PlanTaskStatus } from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Card, Chip, StateView } from "../ui/index.js";

export interface PlanTaskListProps {
  selectedDate: string;
  tasks: PlanTaskDto[];
  busyTaskId: string | null;
  onToggleTask: (task: PlanTaskDto, nextStatus: PlanTaskStatus) => void;
  onDeleteTask: (task: PlanTaskDto) => void;
  onStartSession: (task: PlanTaskDto) => void;
}

export function PlanTaskList({
  selectedDate,
  tasks,
  busyTaskId,
  onToggleTask,
  onDeleteTask,
  onStartSession,
}: PlanTaskListProps) {
  const { locale } = useLocale();
  const t = useTranslations("plan");
  const tDash = useTranslations("dashboard");
  const { palette, radii, space, touchTargets } = useThemeTokens();

  const stats = taskStats(tasks);
  const past = isPastDate(selectedDate);
  const dayLabel = formatDateLabel(selectedDate, locale, t("today_cta"));

  const resolveOriginBadge = (task: PlanTaskDto): string | null => {
    if (!task.origin) return null;
    if (task.origin.type === "MENTORSHIP") return t("origin_coach");
    if (task.origin.type === "AI_COACH" || task.origin.type === "COMMUNITY_COACH") {
      return t("origin_puhu");
    }
    if (task.origin.type === "ANALYSIS" || task.origin.type === "WEEKLY_REPORT") {
      return t("origin_analysis");
    }
    return null;
  };

  if (tasks.length === 0) {
    return (
      <StateView
        title={dayLabel}
        body={t("empty_body")}
        tone="empty"
      />
    );
  }

  return (
    <Card style={{ gap: space.md }}>
      <View style={styles.headerRow}>
        <AppText variant="cardTitle">{dayLabel}</AppText>
        <Chip
          label={tDash("tasks_progress", { done: stats.done, total: stats.total })}
          tone={stats.done === stats.total ? "success" : "default"}
        />
      </View>

      <View style={{ gap: space.sm }}>
        {tasks.map((task) => {
          const isDone = task.status === "DONE";
          const isBusy = busyTaskId === task.id;
          const originBadge = resolveOriginBadge(task);
          const timeRange = formatTimeRange(task.startTime, task.endTime);
          const minutes = task.sessionFocusMinutes ?? task.durationMinutes;

          return (
            <View
              key={task.id}
              style={[
                styles.taskCard,
                {
                  backgroundColor: isDone ? palette.surfaceAlt : palette.surface,
                  borderColor: palette.border,
                  borderRadius: radii.inner,
                  padding: space.md,
                  opacity: isBusy ? 0.6 : 1,
                  gap: space.sm,
                },
              ]}
            >
              <View style={styles.topRow}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isDone, disabled: isBusy || past }}
                  disabled={isBusy || past}
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
                    {timeRange ? (
                      <AppText variant="micro" tone="muted" tabularNums>
                        {timeRange}
                      </AppText>
                    ) : null}
                    {minutes ? (
                      <AppText variant="micro" tone="muted" tabularNums>
                        {minutes} dk
                      </AppText>
                    ) : null}
                  </View>

                  {originBadge ? (
                    <View style={{ marginTop: 2 }}>
                      <Chip label={originBadge} tone="coach" />
                    </View>
                  ) : null}

                  {task.coachNote ? (
                    <AppText variant="caption" tone="coach">
                      {task.coachNote}
                    </AppText>
                  ) : null}
                </View>
              </View>

              {!past ? (
                <View style={styles.actionsRow}>
                  {!isDone ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={isBusy}
                      onPress={() => {
                        haptics.selection();
                        onStartSession(task);
                      }}
                      style={[
                        styles.actionBtn,
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
                        {t("focus_cta")}
                      </AppText>
                    </Pressable>
                  ) : null}

                  {task.origin?.type !== "MENTORSHIP" ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={isBusy}
                      onPress={() => {
                        haptics.selection();
                        onDeleteTask(task);
                      }}
                      style={[
                        styles.actionBtn,
                        {
                          backgroundColor: palette.surfaceAlt,
                          borderColor: palette.border,
                          borderRadius: radii.pill,
                          paddingHorizontal: space.md,
                          paddingVertical: space.xs + 2,
                        },
                      ]}
                    >
                      <AppText variant="caption" tone="danger">
                        {t("task_delete_cta")}
                      </AppText>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  taskCard: {
    borderWidth: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  actionBtn: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
