import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  groupPlanEventsByDate,
  isCoach,
  isCoachAssigned,
  isPastDate,
  parsePlanAdaptationQuery,
  shiftDate,
  summarizePendingWeek,
  todayIso,
  weekDates,
} from "@mentor/core";
import type { PlanEventDto, PlanTaskDto } from "@mentor/types";
import { CoachPlanView } from "../../../components/mentorship/coach/coach-plan-view.js";
import { ActionSheet } from "../../../components/panel/primitives.js";
import { PlanCalendar, PlanCalendarBack, PlanCalendarFab } from "../../../components/plan/calendar/plan-calendar.js";
import { usePlanCalendarData } from "../../../components/plan/calendar/use-plan-calendar-data.js";
import { PlanDateSheet } from "../../../components/plan/plan-date-sheet.js";
import { PlanEventSheet } from "../../../components/plan/plan-event-row.js";
import { PlanPuhuAction, type PlanPuhuActionHandle } from "../../../components/plan/puhu/plan-puhu-action.js";
import { PlanSkeleton } from "../../../components/plan/plan-skeleton.js";
import { PlanTaskCard } from "../../../components/plan/plan-task-card.js";
import { PlanTimeline } from "../../../components/plan/plan-timeline.js";
import { usePlanTaskActions } from "../../../components/plan/use-plan-task-actions.js";
import {
  PlanTaskFormSheet,
  type PlanFormMode,
} from "../../../components/plan/plan-task-form-sheet.js";
import { PlanWeekCard } from "../../../components/plan/plan-week-card.js";
import { AppText, ConfirmDialog, SlidingTabs, StateView } from "../../../components/ui/index.js";
import { listPlanEventsForRange, listPlanTasksForWeek } from "../../../lib/coaching-api.js";
import { haptics } from "../../../lib/haptics.js";
import { mixHex, tabBarClearance } from "../../../lib/layout.js";
import { followDay, initialPlanCalendarState, pickDay, stepCalendar, type PlanCalendarScale } from "../../../lib/plan-calendar.js";
import type { PlanViewMode } from "../../../lib/plan-timeline.js";
import { errorText, parsePlanDateLink, parsePlanTaskPrefill } from "../../../lib/plan-view.js";
import { loadPlanCalendarScale, loadPlanViewMode, savePlanCalendarScale, savePlanViewMode } from "../../../lib/plan-view-store.js";
import { useAppAvailability } from "../../../providers/availability-provider.js";
import { useAuth } from "../../../providers/auth-provider.js";
import { useCelebrations } from "../../../providers/celebration-provider.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { useToast } from "../../../providers/toast-provider.js";

/** The Plan tab: role-aware — CoachPlanView for human coaches, StudentPlanScreen for students. */
export default function PlanScreen() {
  const { user } = useAuth();
  if (isCoach(user)) {
    return <CoachPlanView />;
  }
  return <StudentPlanScreen />;
}

function StudentPlanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { palette, radii } = useThemeTokens();
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const celebrations = useCelebrations();
  const toast = useToast();
  const { availability } = useAppAvailability();
  const puhuRef = useRef<PlanPuhuActionHandle>(null);
  const consumed = useRef<string | null>(null);
  const consumedPrefill = useRef(false);
  const params = useLocalSearchParams<{
    coach?: string; source?: string; sessionId?: string;
    add?: string | string[]; title?: string | string[]; subject?: string | string[];
    date?: string | string[];
  }>();
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<PlanViewMode>(loadPlanViewMode);

  const [view, setView] = useState(() => initialPlanCalendarState(todayIso()));
  const [scale, setScale] = useState(loadPlanCalendarScale);
  const { anchor: weekAnchor, selected: selectedDate } = view;
  const calendarMode = mode === "calendar";
  const calendarData = usePlanCalendarData(view.month, calendarMode);
  const [menuTask, setMenuTask] = useState<PlanTaskDto | null>(null);
  const [formMode, setFormMode] = useState<PlanFormMode | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PlanTaskDto | null>(null);
  const [openEvent, setOpenEvent] = useState<PlanEventDto | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [scrollRequest, setScrollRequest] = useState(0);

  const weekKey = ["plan-tasks", "week", weekAnchor] as const;
  const weekQuery = useQuery({
    queryKey: weekKey,
    queryFn: () => listPlanTasksForWeek(weekAnchor),
    enabled: !calendarMode,
  });
  // Best-effort, like the web's `usePlanEvents`: a student without a coach, or a failed read,
  // simply has no meetings on the list.
  const eventsQuery = useQuery({
    queryKey: ["plan-events", weekAnchor],
    queryFn: async () =>
      groupPlanEventsByDate(await listPlanEventsForRange(weekAnchor, shiftDate(weekAnchor, 6))),
    retry: false,
    enabled: !calendarMode,
  });

  const readOnly = isPastDate(selectedDate);
  const weekTasks = calendarMode
    ? Object.fromEntries(weekDates(weekAnchor).map((iso) => [iso, calendarData.tasksByDate[iso] ?? []]))
    : weekQuery.data ?? {};
  const dayTasks = weekTasks[selectedDate] ?? [];
  const dayEvents = eventsQuery.data?.[selectedDate] ?? [];

  const follow = (iso: string) => setView((current) => followDay(current, iso));
  const requestScroll = () => setScrollRequest((count) => count + 1);
  const selectDay = (iso: string) => {
    setView((current) => pickDay(current, iso));
    requestScroll();
  };
  const step = (direction: -1 | 1) => {
    setView((current) => stepCalendar(current, scale, direction, todayIso()));
    requestScroll();
  };
  const changeScale = (next: PlanCalendarScale) => {
    setScale(next);
    savePlanCalendarScale(next);
  };
  const shiftWeek = (days: number) =>
    setView((current) => stepCalendar(current, "week", days < 0 ? -1 : 1, todayIso()));

  // The panel's "Bugünü hafiflet" lands here as ?coach=adapt&source=mood: open Puhu once, then
  // clear the params so a later visit to the tab does not ask again.
  const { coach, source, sessionId } = params;
  useEffect(() => {
    const request = parsePlanAdaptationQuery({ coach: coach ?? null, source: source ?? null, sessionId: sessionId ?? null });
    const key = request ? `${coach}|${source}|${sessionId ?? ""}` : null;
    const fresh = request !== null && consumed.current !== key;
    consumed.current = key;
    if (!fresh) return;
    router.setParams({ coach: undefined, source: undefined, sessionId: undefined });
    puhuRef.current?.open(request);
  }, [coach, source, sessionId, router]);

  const { add, title, subject } = params;
  useEffect(() => {
    if (add !== "1") {
      consumedPrefill.current = false;
      return;
    }
    if (consumedPrefill.current) return;
    consumedPrefill.current = true;
    const prefill = parsePlanTaskPrefill({ add, title, subject });
    router.setParams({ add: undefined, title: undefined, subject: undefined });
    if (prefill) setFormMode({ kind: "add", date: todayIso(), prefill });
  }, [add, title, subject, router]);

  const { date } = params;
  useEffect(() => {
    if (date === undefined) return;
    const linkedDay = parsePlanDateLink(date);
    router.setParams({ date: undefined });
    if (linkedDay) {
      setView((current) => pickDay(current, linkedDay));
      setScrollRequest((count) => count + 1);
    }
  }, [date, router]);

  /** A new or finished task can earn something ("Plan Hazır", Coin): ask what is unseen. */
  const refreshAfterChange = async () => {
    celebrations.refresh();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["plan-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["weekly-report-follow-up"] }),
      queryClient.invalidateQueries({ queryKey: ["coaching", "today"] }),
      queryClient.invalidateQueries({ queryKey: ["economy", "quests"] }),
    ]);
  };

  const reportError = (error: unknown) => {
    haptics.error();
    toast.show(errorText(error, tCommon("error_body")));
  };

  const { busyId, toggle, remove } = usePlanTaskActions({
    weekKey,
    onChanged: refreshAfterChange,
    onError: reportError,
  });

  const changeMode = useCallback((next: PlanViewMode) => {
    setMode(next);
    savePlanViewMode(next);
  }, []);

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
        // Puhu's wizard is a Modal inside this list in the React tree, and the default "never" would
        // swallow the first tap on its button to close the keyboard.
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={calendarMode}
        refreshControl={
          <RefreshControl
            refreshing={calendarMode ? calendarData.isRefetching : weekQuery.isRefetching}
            onRefresh={() => {
              // A meeting the coach just set appears on a pull, not only after a restart.
              void queryClient.invalidateQueries({ queryKey: ["plan-events"] });
              void refreshAfterChange();
            }}
            tintColor={palette.accent}
          />
        }
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance(insets.bottom) + (calendarMode ? 72 : 0) }]}
      >
        {/* The week card needs no data, so it stays up while a week loads or fails: a second
            arrow tap is never lost, and a failed background refetch keeps the cached week. */}
        {calendarMode || availability.aiCoach ? (
          <View style={calendarMode ? styles.calendarNav : undefined}>
            {calendarMode ? <PlanCalendarBack changeMode={changeMode} /> : null}
            {availability.aiCoach ? (
              <PlanPuhuAction
                ref={puhuRef}
                knownWeek={summarizePendingWeek(weekTasks)}
                onApplied={refreshAfterChange}
                onPlanChanged={refreshAfterChange}
              />
            ) : null}
          </View>
        ) : null}
        {!calendarMode ? <>
          <SlidingTabs
            items={[
              { id: "list", label: t("view_list") },
              { id: "timeline", label: t("view_timeline") },
              { id: "calendar", label: t("view_calendar") },
            ]}
            value={mode}
            onChange={changeMode}
            accessibilityLabel={t("view_switch_aria")}
          />
          <PlanWeekCard
            weekAnchor={weekAnchor}
            selectedDate={selectedDate}
            weekTasks={weekTasks}
            onSelectDate={selectDay}
            onShiftWeek={shiftWeek}
            onOpenDatePicker={() => setDatePickerOpen(true)}
            showDayProgress={mode === "list"}
          />
        </> : null}
        {calendarMode ? (
          <PlanCalendar
            state={view} scale={scale} data={calendarData} scrollRequest={scrollRequest}
            onScaleChange={changeScale} onPick={selectDay} onFollow={follow} onStep={step}
            onToday={() => selectDay(todayIso())} onOpenEvent={setOpenEvent}
            onCreateAt={(date, startTime) => setFormMode({ kind: "add", date, startTime, origin: "calendar" })}
            onEdit={(task) => setFormMode({ kind: "edit", task })}
            onDelete={setPendingDelete}
            deleteDisabled={busyId !== null}
          />
        ) : weekQuery.data === undefined && weekQuery.isError ? (
          <StateView
            title={tCommon("error_title")}
            body={tCommon("error_body")}
            actionLabel={tCommon("retry")}
            onAction={() => void weekQuery.refetch()}
            tone="error"
          />
        ) : mode === "timeline" ? (
          // Mounted across weeks, so an uncached week loads under the card's own cover.
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)}>
            <PlanTimeline
              weekAnchor={weekAnchor}
              weekTasks={weekTasks}
              loading={weekQuery.data === undefined}
              selectedDate={selectedDate}
              scrollRequest={scrollRequest}
              busyId={busyId}
              onSelectDate={selectDay}
              onActiveDayChange={follow}
              onAdd={() => setFormMode({ kind: "add", date: selectedDate })}
              onToggle={(task) => void toggle(task)}
              onOpenMenu={setMenuTask}
              onStartSession={startSession}
            />
          </Animated.View>
        ) : weekQuery.data === undefined ? (
          <PlanSkeleton />
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

      {calendarMode ? (
        <PlanCalendarFab date={selectedDate} bottom={tabBarClearance(insets.bottom)}
          onPress={() => setFormMode({ kind: "add", date: selectedDate, origin: "calendar" })} />
      ) : null}
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
        onConfirm={() => {
          setPendingDelete(null);
          if (pendingDelete) void remove(pendingDelete);
        }}
        onCancel={() => setPendingDelete(null)}
      />
      <PlanTaskFormSheet
        mode={formMode}
        onClose={() => setFormMode(null)}
        onSaved={(task) => {
          setFormMode(null);
          follow(task.taskDate);
          requestScroll();
          void refreshAfterChange();
        }}
      />
      {datePickerOpen ? (
        <PlanDateSheet
          visible
          initialDate={selectedDate}
          onApply={(iso) => {
            setDatePickerOpen(false);
            follow(iso);
            requestScroll();
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
  calendarNav: { flexDirection: "row", alignItems: "center", gap: 8 },
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
