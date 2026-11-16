import { useCallback, useState } from "react";
import { BackHandler, Platform, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { AddIcon } from "@solar-icons/react-native/linear/add";
import { ArrowLeftIcon } from "@solar-icons/react-native/linear/arrow-left";
import { formatDateLabel, isPastDate } from "@mentor/core";
import type { PlanEventDto, PlanTaskDto } from "@mentor/types";
import { cardShadow } from "../../../lib/layout.js";
import { highlightedSubject, type PlanCalendarScale, type PlanCalendarState } from "../../../lib/plan-calendar.js";
import type { PlanViewMode } from "../../../lib/plan-timeline.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { PanelCard } from "../../panel/primitives.js";
import { Skeleton } from "../../ui/skeleton.js";
import { StateView } from "../../ui/state-view.js";
import { PlanAgenda } from "./plan-agenda.js";
import { PlanCalendarHeader } from "./plan-calendar-header.js";
import { PlanDayGrid } from "./plan-day-grid.js";
import { PlanMonthBoard } from "./plan-month-board.js";
import { PlanSubjectLegend } from "./plan-subject-legend.js";
import { PlanTaskDetailsSheet } from "./plan-task-details-sheet.js";
import type { usePlanCalendarData } from "./use-plan-calendar-data.js";

export function PlanCalendar({
  state, scale, data, scrollRequest, onScaleChange, onPick, onFollow, onStep, onToday, onEdit, onDelete, deleteDisabled, onOpenEvent, onCreateAt,
}: {
  state: PlanCalendarState;
  scale: PlanCalendarScale;
  data: ReturnType<typeof usePlanCalendarData>;
  scrollRequest: number;
  onScaleChange: (scale: PlanCalendarScale) => void;
  onPick: (iso: string) => void;
  onFollow: (iso: string) => void;
  onStep: (direction: -1 | 1) => void;
  onToday: () => void;
  onEdit: (task: PlanTaskDto) => void;
  onDelete: (task: PlanTaskDto) => void;
  deleteDisabled: boolean;
  onOpenEvent: (event: PlanEventDto) => void;
  onCreateAt: (date: string, startTime: string) => void;
}) {
  const tCommon = useTranslations("common");
  const [picked, setPicked] = useState<string | null>(null);
  const [task, setTask] = useState<PlanTaskDto | null>(null);
  const [handoff, setHandoff] = useState<"edit" | "delete" | null>(null);
  const expanded = scale === "month";
  const monthKey = state.month.slice(0, 7);
  const active = expanded ? highlightedSubject(picked, data.tasksByDate, monthKey) : null;
  const openItem = (source: PlanTaskDto | PlanEventDto) => {
    if ("taskDate" in source) setTask(source);
    else onOpenEvent(source);
  };
  const openAction = (action: "edit" | "delete", item: PlanTaskDto) => {
    // iOS can present the next Modal only after the first one's dismissal animation.
    if (Platform.OS === "ios") {
      setHandoff(action);
      return;
    }
    setTask(null);
    (action === "edit" ? onEdit : onDelete)(item);
  };

  return (
    <PanelCard style={styles.card}>
      <PlanCalendarHeader scale={scale} month={state.month} selectedDate={state.selected} onScaleChange={onScaleChange} onStep={onStep} onToday={onToday} />
      <PlanMonthBoard
        month={state.month}
        selectedDate={state.selected}
        itemsByDate={data.itemsByDate}
        holidaysByDate={data.holidaysByDate}
        highlight={active}
        expanded={expanded}
        onSelectDate={onPick}
        onOpenItem={openItem}
        onExpandedChange={(open) => onScaleChange(open ? "month" : "day")}
      />
      {data.loading && data.isError ? (
        <StateView
          title={tCommon("error_title")}
          body={tCommon("error_body")}
          actionLabel={tCommon("retry")}
          onAction={data.refetch}
          tone="error"
        />
      ) : expanded ? (
        data.loading ? <View style={styles.legendPlaceholder}>
          <Skeleton width={82} height={36} />
          <Skeleton width={66} height={36} />
          <Skeleton width={95} height={36} />
        </View> : (
          <PlanSubjectLegend monthKey={monthKey} tasksByDate={data.tasksByDate} active={active} onSelect={setPicked} />
        )
      ) : scale === "day" ? (
        <PlanDayGrid
          key={state.selected}
          date={state.selected}
          items={data.itemsByDate[state.selected] ?? []}
          holiday={data.holidaysByDate[state.selected]}
          loading={data.dayLoading}
          onOpenItem={openItem}
          onCreateAt={onCreateAt}
        />
      ) : (
        <PlanAgenda
          key={state.month}
          days={data.days}
          month={state.month}
          itemsByDate={data.itemsByDate}
          holidaysByDate={data.holidaysByDate}
          loading={data.loading}
          selectedDate={state.selected}
          scrollRequest={scrollRequest}
          onActiveDayChange={onFollow}
          onOpenItem={openItem}
        />
      )}
      <PlanTaskDetailsSheet
        task={task}
        visible={handoff === null}
        onClose={() => setTask(null)}
        onEdit={(item) => openAction("edit", item)}
        onDelete={(item) => openAction("delete", item)}
        deleteDisabled={deleteDisabled}
        onDismiss={() => {
          if (!handoff || !task) return;
          setTask(null);
          setHandoff(null);
          (handoff === "edit" ? onEdit : onDelete)(task);
        }}
      />
    </PanelCard>
  );
}

export function PlanCalendarBack({ changeMode }: { changeMode: (mode: PlanViewMode) => void }) {
  const t = useTranslations("plan");
  const { palette } = useThemeTokens();
  const back = useCallback(() => changeMode("list"), [changeMode]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => subscription.remove();
  }, [back]));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("calendar_back")}
      hitSlop={4}
      onPress={back}
      style={[styles.back, { backgroundColor: palette.surfaceAlt }]}
    >
      <ArrowLeftIcon size={22} color={palette.main} />
    </Pressable>
  );
}

export function PlanCalendarFab({ date, bottom, onPress }: { date: string; bottom: number; onPress: () => void }) {
  const t = useTranslations("plan");
  const { locale } = useLocale();
  const { palette } = useThemeTokens();
  if (isPastDate(date)) return null;
  const label = t("calendar_add_on", { date: formatDateLabel(date, locale, t("today"), { alwaysFull: true }) });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.fab, cardShadow, { backgroundColor: palette.main, bottom }]}
    >
      <AddIcon size={26} color={palette.surface} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, gap: 12 },
  legendPlaceholder: { flexDirection: "row", gap: 6 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  fab: {
    position: "absolute", right: 20, zIndex: 1,
    width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center",
  },
});
