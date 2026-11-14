import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { formatDateLabel, isPastDate, taskStats, todayIso } from "@mentor/core";
import type { PlanTaskDto } from "@mentor/types";
import { orderTimelineTasks, TIMELINE_RAIL_X } from "../../lib/plan-timeline.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/text.js";
import { PlanTaskRow } from "./plan-task-row.js";

const DOT = 12;

/**
 * One day on the Timeline rail (the web's timeline `<section>`): a dot on the rail (the active
 * day's badge is drawn by the parent instead), the day's title and "done/total", then its rows.
 * Memoised: each day's first layout re-renders the parent, and the week must not redraw seven
 * times before its pin.
 */
export const PlanTimelineDay = memo(function PlanTimelineDay({
  iso,
  tasks,
  active,
  busyId,
  onLayout,
  onSelect,
  onToggle,
  onOpenMenu,
  onStartSession,
}: {
  iso: string;
  tasks: PlanTaskDto[];
  active: boolean;
  busyId: string | null;
  /** Where the section sits inside the rail box; the parent scrolls and snaps by it. */
  onLayout: (iso: string, top: number, height: number) => void;
  onSelect: (iso: string) => void;
  onToggle: (task: PlanTaskDto) => void;
  onOpenMenu: (task: PlanTaskDto) => void;
  onStartSession: (task: PlanTaskDto) => void;
}) {
  const { palette } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("plan");
  const reduceMotion = useReducedMotion();
  const isToday = iso === todayIso();
  const past = isPastDate(iso);
  const stats = taskStats(tasks);
  const fullLabel = formatDateLabel(iso, locale, t("today"), { alwaysFull: true });

  return (
    <View
      onLayout={(event) => onLayout(iso, event.nativeEvent.layout.y, event.nativeEvent.layout.height)}
      style={[styles.section, { opacity: active || reduceMotion ? 1 : 0.78 }]}
    >
      {active ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fullLabel}
          hitSlop={16}
          onPress={() => onSelect(iso)}
          style={[
            styles.dot,
            {
              backgroundColor: isToday ? palette.progress : palette.surface,
              borderColor: isToday ? palette.progress : palette.progressTrack,
              opacity: past ? 0.75 : 1,
            },
          ]}
        />
      )}
      <View style={[styles.header, active ? styles.headerActive : styles.headerIdle]}>
        <AppText numberOfLines={1} style={[styles.title, { color: palette.main }]}>
          {isToday ? t("today") : fullLabel}
        </AppText>
        {stats.total > 0 ? (
          <AppText tabularNums tone="secondary" style={styles.stats}>
            {`${stats.done}/${stats.total}`}
          </AppText>
        ) : null}
      </View>
      {tasks.length === 0 ? (
        <AppText tone="secondary" style={styles.empty}>
          {t("timeline_day_empty")}
        </AppText>
      ) : (
        orderTimelineTasks(tasks).map((task) => (
          <PlanTaskRow
            key={task.id}
            dense
            task={task}
            readOnly={past}
            busy={busyId === task.id}
            onToggle={() => onToggle(task)}
            onOpenMenu={() => onOpenMenu(task)}
            onStartSession={() => onStartSession(task)}
          />
        ))
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    paddingLeft: 44,
    paddingBottom: 16,
  },
  dot: {
    position: "absolute",
    top: 10,
    left: TIMELINE_RAIL_X - DOT / 2,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    zIndex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  headerActive: {
    minHeight: 36,
  },
  // The web's idle header is 4dp shorter; one height keeps every later day still when the
  // active day changes, so nothing re-measures mid-scroll.
  headerIdle: {
    minHeight: 36,
    paddingTop: 4,
  },
  title: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "700",
  },
  stats: {
    fontSize: 11,
    lineHeight: 14,
  },
  empty: {
    fontSize: 12,
    lineHeight: 16,
    paddingVertical: 4,
  },
});
