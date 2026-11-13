import { useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  groupPlanEventsByDate,
  isCoachAssigned,
  isPastDate,
  shiftDate,
  todayIso,
  weekStart,
} from "@mentor/core";
import type { PlanEventDto, PlanTaskDto } from "@mentor/types";
import { ActionSheet } from "../../../components/panel/primitives.js";
import { PlanDateSheet } from "../../../components/plan/plan-date-sheet.js";
import { PlanEventSheet } from "../../../components/plan/plan-event-row.js";
import { PlanSkeleton } from "../../../components/plan/plan-skeleton.js";
import { PlanTaskCard } from "../../../components/plan/plan-task-card.js";
import {
  PlanTaskFormSheet,
  type PlanFormMode,
} from "../../../components/plan/plan-task-form-sheet.js";
import { PlanWeekCard } from "../../../components/plan/plan-week-card.js";
import { AppText, ConfirmDialog, StateView } from "../../../components/ui/index.js";
import {
  deletePlanTask,
  listPlanEventsForRange,
  listPlanTasksForWeek,
  updatePlanTask,
} from "../../../lib/coaching-api.js";
import { haptics } from "../../../lib/haptics.js";
import { mixHex, tabBarClearance } from "../../../lib/layout.js";
import {
  errorText,
  shiftPlanWeek,
  withTaskStatus,
  type PlanWeekView,
} from "../../../lib/plan-view.js";
import { useAuth } from "../../../providers/auth-provider.js";
import { useCelebrations } from "../../../providers/celebration-provider.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { useToast } from "../../../providers/toast-provider.js";

/** The Plan tab, Liste view: the web's `PlanShell` at phone width (switcher and Puhu hidden for now). */
export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { palette, radii } = useThemeTokens();
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const celebrations = useCelebrations();
  const toast = useToast();
  const { user } = useAuth();

  // One state, so an arrow tap that lands before the re-render still moves from the latest week.
  const [view, setView] = useState<PlanWeekView>(() => ({
    anchor: weekStart(todayIso()),
    selected: todayIso(),
  }));
  const { anchor: weekAnchor, selected: selectedDate } = view;
  const [busyId, setBusyId] = useState<string | null>(null);
  // State re-renders the rows; the ref closes the gap before that render, so a second tap in the
  // same frame cannot send a second PATCH.
  const busyRef = useRef<string | null>(null);
  const [menuTask, setMenuTask] = useState<PlanTaskDto | null>(null);
  const [formMode, setFormMode] = useState<PlanFormMode | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PlanTaskDto | null>(null);
  const [openEvent, setOpenEvent] = useState<PlanEventDto | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const weekKey = ["plan-tasks", "week", weekAnchor] as const;
  const weekQuery = useQuery({
    queryKey: weekKey,
    queryFn: () => listPlanTasksForWeek(weekAnchor),
  });
  // Best-effort, like the web's `usePlanEvents`: a student without a coach, or a failed read,
  // simply has no meetings on the list.
  const eventsQuery = useQuery({
    queryKey: ["plan-events", weekAnchor],
    queryFn: async () =>
      groupPlanEventsByDate(await listPlanEventsForRange(weekAnchor, shiftDate(weekAnchor, 6))),
    retry: false,
  });

  const readOnly = isPastDate(selectedDate);
  const weekTasks = weekQuery.data ?? {};
  const dayTasks = weekTasks[selectedDate] ?? [];
  const dayEvents = eventsQuery.data?.[selectedDate] ?? [];

  const selectDay = (iso: string) => setView({ anchor: weekStart(iso), selected: iso });

  const shiftWeek = (days: number) => setView((current) => shiftPlanWeek(current, days, todayIso()));

  /** A new or finished task can earn something ("Plan Hazır", Coin): ask what is unseen. */
  const refreshAfterChange = async () => {
    celebrations.refresh();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["plan-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["coaching", "today"] }),
      queryClient.invalidateQueries({ queryKey: ["economy", "quests"] }),
    ]);
  };

  const reportError = (error: unknown) => {
    haptics.error();
    toast.show(errorText(error, tCommon("error_body")));
  };

  const begin = (id: string) => {
    busyRef.current = id;
    setBusyId(id);
  };
  const end = () => {
    busyRef.current = null;
    setBusyId(null);
  };

  const toggle = async (task: PlanTaskDto) => {
    if (busyRef.current || isPastDate(task.taskDate)) return;
    begin(task.id);
    const nextStatus = task.status === "DONE" ? "PENDING" : "DONE";
    // A refetch already in flight (focus, pull) would land the old status over the tick.
    await queryClient.cancelQueries({ queryKey: weekKey });
    const previous = queryClient.getQueryData<Record<string, PlanTaskDto[]>>(weekKey);
    if (previous) queryClient.setQueryData(weekKey, withTaskStatus(previous, task.id, nextStatus));
    try {
      await updatePlanTask(task.id, { status: nextStatus });
    } catch (error) {
      if (previous) queryClient.setQueryData(weekKey, previous);
      reportError(error);
      return;
    } finally {
      // Free the rows once the write lands: the refetches below need no lock, and a delete
      // confirmed meanwhile must not be dropped.
      end();
    }
    if (nextStatus === "DONE") haptics.lightImpact();
    void refreshAfterChange();
  };

  const remove = async (task: PlanTaskDto) => {
    setPendingDelete(null);
    if (busyRef.current || isPastDate(task.taskDate)) return;
    begin(task.id);
    try {
      await deletePlanTask(task.id);
    } catch (error) {
      reportError(error);
      return;
    } finally {
      end();
    }
    void refreshAfterChange();
  };

  const startSession = (task: PlanTaskDto) => {
    const params: Record<string, string> = { taskId: task.id, taskTitle: task.title };
    if (task.subject) params.subject = task.subject;
    const focusMinutes = task.sessionFocusMinutes ?? task.durationMinutes;
    if (focusMinutes) params.minutes = String(focusMinutes);
    router.push({ pathname: "/(app)/study-session" as never, params });
  };

  const menuActions = menuTask
    ? [
        ...(isCoachAssigned(menuTask)
          ? []
          : [
              {
                label: t("task_action_edit"),
                onPress: () => setFormMode({ kind: "edit", task: menuTask }),
              },
            ]),
        {
          label: t("task_action_delete"),
          tone: "danger" as const,
          onPress: () => setPendingDelete(menuTask),
        },
      ]
    : [];

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: palette.bg }}
        refreshControl={
          <RefreshControl
            refreshing={weekQuery.isRefetching}
            onRefresh={() => {
              // A meeting the coach just set appears on a pull, not only after a restart.
              void queryClient.invalidateQueries({ queryKey: ["plan-events"] });
              void refreshAfterChange();
            }}
            tintColor={palette.accent}
          />
        }
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance(insets.bottom) }]}
      >
        {/* The week card needs no data, so it stays up while a week loads or fails: a second
            arrow tap is never lost, and a failed background refetch keeps the cached week. */}
        <PlanWeekCard
          weekAnchor={weekAnchor}
          selectedDate={selectedDate}
          weekTasks={weekTasks}
          onSelectDate={selectDay}
          onShiftWeek={shiftWeek}
          onOpenDatePicker={() => setDatePickerOpen(true)}
        />
        {weekQuery.data === undefined ? (
          weekQuery.isError ? (
            <StateView
              title={tCommon("error_title")}
              body={tCommon("error_body")}
              actionLabel={tCommon("retry")}
              onAction={() => void weekQuery.refetch()}
              tone="error"
            />
          ) : (
            <PlanSkeleton />
          )
        ) : (
          <>
            {readOnly ? (
              <View
                style={[
                  styles.notice,
                  {
                    backgroundColor: mixHex(palette.progressTrack, palette.bg, 0.35),
                    borderRadius: radii.card,
                  },
                ]}
              >
                <AppText style={styles.noticeText}>{t("past_readonly_notice")}</AppText>
              </View>
            ) : null}
            <PlanTaskCard
              readOnly={readOnly}
              tasks={dayTasks}
              events={dayEvents}
              viewerId={user?.id ?? null}
              busyId={busyId}
              onAdd={() => setFormMode({ kind: "add", date: selectedDate })}
              onToggle={(task) => void toggle(task)}
              onOpenMenu={setMenuTask}
              onStartSession={startSession}
              onOpenEvent={setOpenEvent}
            />
          </>
        )}
      </ScrollView>

      <ActionSheet
        title={menuTask?.title ?? null}
        actions={menuActions}
        onClose={() => setMenuTask(null)}
      />
      <ConfirmDialog
        visible={pendingDelete !== null}
        title={t("task_delete_confirm_title")}
        message={t("task_delete_confirm_message")}
        confirmLabel={t("task_delete_confirm_yes")}
        cancelLabel={t("task_delete_confirm_no")}
        destructive
        onConfirm={() => pendingDelete && void remove(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
      <PlanTaskFormSheet
        mode={formMode}
        onClose={() => setFormMode(null)}
        onSaved={(task) => {
          setFormMode(null);
          selectDay(task.taskDate);
          void refreshAfterChange();
        }}
      />
      {datePickerOpen ? (
        <PlanDateSheet
          visible
          initialDate={selectedDate}
          onApply={(iso) => {
            setDatePickerOpen(false);
            selectDay(iso);
          }}
          onClose={() => setDatePickerOpen(false)}
        />
      ) : null}
      <PlanEventSheet
        event={openEvent}
        viewerId={user?.id ?? null}
        onClose={() => setOpenEvent(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 16,
    paddingHorizontal: 20,
    gap: 20,
  },
  notice: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
