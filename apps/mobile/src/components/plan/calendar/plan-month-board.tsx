import { useLayoutEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation, Easing, FadeIn, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming,
} from "react-native-reanimated";
import { spotlightDelay, todayIso } from "@mentor/core";
import type { PlanEventDto, PlanTaskDto, PublicHolidayDto } from "@mentor/types";
import { mixHex } from "../../../lib/layout.js";
import { boardDays, boardWeekRow, type PlanBoardItem } from "../../../lib/plan-calendar.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { AppText } from "../../ui/text.js";

const ROW = 84;
const ROWS = 6;
const COLUMNS = 7;
const COLLAPSED = 40;
const TRAVEL = ROWS * ROW - COLLAPSED;
const CIRCLE = 32;
const DAY_TOP = 4;
const MAX_CHIPS = 2;
const SETTLE = { duration: 240, easing: Easing.bezier(0.22, 1, 0.36, 1) };
const PILL_SPRING = { stiffness: 420, damping: 36, mass: 1 };
const WEEKDAYS = ["week_mon", "week_tue", "week_wed", "week_thu", "week_fri", "week_sat", "week_sun"] as const;

export function PlanMonthBoard({
  month, selectedDate, itemsByDate, holidaysByDate, highlight, expanded, onSelectDate, onOpenItem, onExpandedChange,
}: {
  month: string;
  selectedDate: string;
  itemsByDate: Record<string, PlanBoardItem[]>;
  holidaysByDate: Record<string, PublicHolidayDto>;
  highlight: string | null;
  expanded: boolean;
  onSelectDate: (iso: string) => void;
  onOpenItem: (source: PlanTaskDto | PlanEventDto) => void;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const { palette } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("plan");
  const reduceMotion = useReducedMotion();
  const days = useMemo(() => boardDays(month), [month]);
  const dayLabels = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "tr-TR", {
      weekday: "long", day: "numeric", month: "long",
    });
    return days.map((iso) => format.format(new Date(iso + "T12:00:00")));
  }, [days, locale]);
  const today = todayIso();
  const monthKey = month.slice(0, 7);
  const selectedRow = boardWeekRow(days, selectedDate);
  const selectedColumn = Math.max(0, days.indexOf(selectedDate)) % COLUMNS;
  const [width, setWidth] = useState(0);
  const cellWidth = width / COLUMNS;
  const progress = useSharedValue(expanded ? 1 : 0);
  const target = useSharedValue(expanded);
  const base = useSharedValue(0);
  const revision = useSharedValue(0);
  const dragRevision = useSharedValue(0);
  const row = useSharedValue(selectedRow);
  const pillColumn = useSharedValue(selectedColumn);
  const pillRow = useSharedValue(selectedRow);

  useLayoutEffect(() => {
    // A segment choice takes precedence over a pan started on the previous scale.
    revision.value += 1;
    if (target.value === expanded) return;
    target.value = expanded;
    const next = expanded ? 1 : 0;
    progress.value = reduceMotion ? next : withTiming(next, SETTLE);
  }, [expanded, progress, reduceMotion, revision, target]);

  useLayoutEffect(() => {
    row.value = reduceMotion ? selectedRow : withTiming(selectedRow, SETTLE);
    pillRow.value = reduceMotion ? selectedRow : withSpring(selectedRow, PILL_SPRING);
  }, [selectedRow, reduceMotion, row, pillRow]);
  useLayoutEffect(() => {
    pillColumn.value = reduceMotion ? selectedColumn : withSpring(selectedColumn, PILL_SPRING);
  }, [selectedColumn, reduceMotion, pillColumn]);

  const clipStyle = useAnimatedStyle(() => ({ height: COLLAPSED + progress.value * TRAVEL }));
  const gridStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -(1 - progress.value) * row.value * ROW }],
  }));
  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pillColumn.value * cellWidth + (cellWidth - CIRCLE) / 2 },
      { translateY: pillRow.value * ROW + DAY_TOP },
    ],
  }));

  const settle = (open: boolean) => {
    "worklet";
    const next = open ? 1 : 0;
    progress.value = reduceMotion ? next : withTiming(next, SETTLE);
    if (target.value === open) return;
    target.value = open;
    runOnJS(onExpandedChange)(open);
  };
  const pan = usePanGesture({
    activeOffsetY: [-4, 4],
    failOffsetX: [-24, 24],
    onActivate: () => {
      "worklet";
      dragRevision.value = revision.value;
      cancelAnimation(progress);
      base.value = progress.value;
    },
    onUpdate: (event) => {
      "worklet";
      if (dragRevision.value !== revision.value) return;
      progress.value = Math.min(1, Math.max(0, base.value + event.translationY / TRAVEL));
    },
    onDeactivate: (event) => {
      "worklet";
      if (dragRevision.value === revision.value) settle(event.canceled ? target.value : progress.value > 0.5);
    },
  });
  const tap = useTapGesture({
    maxDeltaY: 4,
    onDeactivate: (event) => {
      "worklet";
      if (!event.canceled) settle(!target.value);
    },
  });
  const handleGesture = useCompetingGestures(pan, tap);

  const litIndices = useMemo(() => {
    const indices = new Map<PlanBoardItem, number>();
    if (highlight !== null) {
      for (const iso of days) {
        for (const item of (itemsByDate[iso] ?? []).slice(0, MAX_CHIPS)) {
          if (item.groupKey === highlight) indices.set(item, indices.size);
        }
      }
    }
    return indices;
  }, [days, itemsByDate, highlight]);

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.weekdays}>
        {WEEKDAYS.map((key) => (
          <AppText key={key} tone="secondary" numberOfLines={1} style={styles.weekday}>
            {t(key).toLocaleUpperCase(locale)}
          </AppText>
        ))}
      </View>
      <Animated.View style={[styles.clip, clipStyle]}>
        <Animated.View style={gridStyle}>
          {width > 0 ? (
            <Animated.View pointerEvents="none" style={[styles.pill, { backgroundColor: palette.progress }, pillStyle]} />
          ) : null}
          {Array.from({ length: ROWS }, (_, week) => (
            <View
              key={week}
              style={styles.row}
              accessibilityElementsHidden={!expanded && week !== selectedRow}
              importantForAccessibility={!expanded && week !== selectedRow ? "no-hide-descendants" : "auto"}
            >
              {days.slice(week * COLUMNS, (week + 1) * COLUMNS).map((iso, column) => {
                const selected = iso === selectedDate;
                const isToday = iso === today;
                const holiday = holidaysByDate[iso];
                const items = itemsByDate[iso] ?? [];
                const opacity = iso.slice(0, 7) !== monthKey ? 0.45 : iso < today ? 0.75 : 1;
                const color = selected ? "#FFFFFF" : isToday ? palette.progress : holiday ? palette.chipText : palette.main;
                const label = dayLabels[week * COLUMNS + column];
                return (
                  <View key={iso} style={[styles.cell, { opacity }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={isToday ? t("today") + ", " + label : label}
                      hitSlop={{ top: DAY_TOP, bottom: 4, left: 4, right: 4 }}
                      onPress={() => onSelectDate(iso)}
                      style={styles.dayButton}
                    >
                      <AppText style={[styles.dayNumber, { color }]}>{Number(iso.slice(8, 10))}</AppText>
                    </Pressable>
                    <View
                      style={styles.cellItems}
                      accessibilityElementsHidden={!expanded}
                      importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
                    >
                      {holiday ? (
                        <AppText numberOfLines={1} accessibilityLabel={holiday.name}
                          style={[styles.micro, { color: palette.chipText, opacity: 0.75 }]}>
                          {holiday.name}
                        </AppText>
                      ) : null}
                      {items.slice(0, MAX_CHIPS).map((item) => {
                        const litIndex = litIndices.get(item);
                        return (
                          <Pressable
                            key={item.id}
                            accessibilityRole="button"
                            accessibilityLabel={item.title}
                            onPress={() => onOpenItem(item.source)}
                            style={[styles.chip, {
                              backgroundColor: item.color.bg,
                              borderLeftColor: item.color.bar,
                              opacity: highlight && litIndex === undefined ? 0.32 : 1,
                            }]}
                          >
                            <AppText numberOfLines={1} style={[styles.micro, item.muted && styles.muted]}>
                              {item.title}
                            </AppText>
                            {litIndex !== undefined ? (
                              <Animated.View
                                pointerEvents="none"
                                entering={reduceMotion ? undefined : FadeIn.delay(spotlightDelay(litIndex)).duration(260)}
                                style={[StyleSheet.absoluteFill, styles.ring, { borderColor: item.color.bar }]}
                              />
                            ) : null}
                          </Pressable>
                        );
                      })}
                      {items.length > MAX_CHIPS ? (
                        <AppText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
                          style={[styles.micro, { color: palette.progress, fontWeight: "600" }]}>
                          {t("calendar_more", { count: items.length - MAX_CHIPS })}
                        </AppText>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </Animated.View>
      </Animated.View>
      <GestureDetector gesture={handleGesture}>
        <View
          accessible
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel={t(expanded ? "calendar_strip_collapse" : "calendar_strip_expand")}
          accessibilityState={{ expanded }}
          accessibilityActions={[{ name: "activate" }]}
          onAccessibilityAction={({ nativeEvent }) => {
            if (nativeEvent.actionName === "activate") onExpandedChange(!expanded);
          }}
          style={styles.handle}
        >
          <View style={[styles.handleBar, { backgroundColor: mixHex(palette.main, palette.surface, 0.22) }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  weekdays: { flexDirection: "row", paddingBottom: 4 },
  weekday: { flex: 1, textAlign: "center", fontSize: 11, lineHeight: 14, fontWeight: "500" },
  clip: { overflow: "hidden" },
  row: { flexDirection: "row", height: ROW },
  cell: { flex: 1, minWidth: 0, alignItems: "center", paddingTop: DAY_TOP, paddingHorizontal: 1 },
  pill: { position: "absolute", top: 0, left: 0, width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2 },
  dayButton: { width: CIRCLE, height: CIRCLE, alignItems: "center", justifyContent: "center" },
  dayNumber: { fontSize: 14, lineHeight: 18, fontWeight: "700" },
  cellItems: { alignSelf: "stretch", marginTop: COLLAPSED - DAY_TOP - CIRCLE, gap: 1 },
  chip: { borderLeftWidth: 2, borderRadius: 3, paddingHorizontal: 2 },
  ring: { borderRadius: 3, borderWidth: 1 },
  muted: { textDecorationLine: "line-through" },
  micro: { fontSize: 8, lineHeight: 10, includeFontPadding: false },
  handle: { width: 112, height: 44, alignSelf: "center", alignItems: "center", justifyContent: "center" },
  handleBar: { width: 40, height: 4, borderRadius: 2 },
});
