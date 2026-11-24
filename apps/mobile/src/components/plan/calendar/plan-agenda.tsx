import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewInstance } from "react-native";
import { formatTimeRange, layoutDayEvents, todayIso } from "@mentor/core";
import type { PublicHolidayDto } from "@mentor/types";
import { mixHex } from "../../../lib/layout.js";
import { agendaActiveDay, type PlanBoardItem } from "../../../lib/plan-calendar.js";
import { scrollSync, timelineEndSpace } from "../../../lib/plan-timeline.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { Skeleton } from "../../ui/skeleton.js";
import { AppText } from "../../ui/text.js";

const JUMP_MS = 120;
type DayBox = { top: number; height: number };

export function PlanAgenda({
  days, month, itemsByDate, holidaysByDate, loading, selectedDate, scrollRequest, onActiveDayChange, onOpenItem,
}: {
  days: string[];
  month: string;
  itemsByDate: Record<string, PlanBoardItem[]>;
  holidaysByDate: Record<string, PublicHolidayDto>;
  loading: boolean;
  selectedDate: string;
  scrollRequest: number;
  onActiveDayChange: (iso: string) => void;
  onOpenItem: (source: PlanBoardItem["source"]) => void;
}) {
  const { palette } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("plan");
  const today = todayIso();
  const { height: windowHeight } = useWindowDimensions();
  const height = 0.6 * windowHeight;
  const [boxes, setBoxes] = useState<Record<string, DayBox>>({});
  const [readyMonth, setReadyMonth] = useState<string | null>(null);
  const [viewport, setViewport] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const handled = useRef(scrollRequest);
  const emitted = useRef(selectedDate);
  const suppressUntil = useRef(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const ready = readyMonth === month;
  const targetTop = boxes[selectedDate]?.top;
  const tops = useMemo(
    () => days.flatMap((iso) => boxes[iso] ? [{ iso, top: boxes[iso].top }] : []),
    [days, boxes],
  );
  const measured = viewport > 0 && tops.length === days.length;
  const endSpace = timelineEndSpace(height, boxes[days[days.length - 1]!]?.height, 0);
  const formatted = useMemo(() => {
    const language = locale === "en" ? "en-GB" : "tr-TR";
    const shortDate = new Intl.DateTimeFormat(language, { day: "numeric", month: "short" });
    const weekday = new Intl.DateTimeFormat(language, { weekday: "long" });
    return days.map((iso) => {
      const date = new Date(iso + "T12:00:00");
      return { label: shortDate.format(date), weekday: weekday.format(date) };
    });
  }, [days, locale]);

  useEffect(() => {
    const action = scrollSync({
      range: month, pinnedRange: readyMonth, loading, measured, request: scrollRequest, handled: handled.current,
    });
    if (action !== "pin" && action !== "scroll") return;
    // For the final day Fabric needs the end spacer in the native scroll range before we jump.
    if (targetTop === undefined || contentHeight + 1 < targetTop + viewport || !scrollRef.current) return;
    handled.current = scrollRequest;
    emitted.current = selectedDate;
    suppressUntil.current = Date.now() + JUMP_MS;
    scrollRef.current.scrollTo({ y: targetTop, animated: false });
    if (action === "pin") setReadyMonth(month);
  }, [contentHeight, loading, measured, month, readyMonth, scrollRequest, selectedDate, targetTop, viewport]);

  return (
    <View style={{ height }}>
      <ScrollView
        ref={scrollRef}
        style={!ready ? styles.hidden : undefined}
        accessible={ready ? undefined : false}
        accessibilityLabel={t("calendar_scale_agenda")}
        accessibilityElementsHidden={!ready}
        importantForAccessibility={ready ? "auto" : "no-hide-descendants"}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        nestedScrollEnabled
        scrollEnabled={ready}
        scrollEventThrottle={16}
        onLayout={(event) => setViewport(event.nativeEvent.layout.height)}
        onContentSizeChange={(_width, size) => setContentHeight(size)}
        onScrollBeginDrag={() => { suppressUntil.current = 0; }}
        onScroll={(event) => {
          if (!ready || scrollRequest !== handled.current || Date.now() < suppressUntil.current) return;
          const iso = agendaActiveDay(tops, event.nativeEvent.contentOffset.y);
          if (!iso || iso === emitted.current) return;
          emitted.current = iso;
          onActiveDayChange(iso);
        }}
      >
        {!loading ? days.map((iso, index) => {
          const isToday = iso === today;
          const day = formatted[index]!;
          const holiday = holidaysByDate[iso];
          const { allDay, timed } = layoutDayEvents(itemsByDate[iso] ?? []);
          const items = [...allDay, ...timed.map(({ event }) => event)];
          return (
            <View
              key={iso}
              style={[styles.day, {
                borderBottomColor: mixHex(palette.main, palette.surface, 0.08),
                opacity: iso < today ? 0.7 : 1,
              }]}
              onLayout={(event) => {
                const { y: top, height: dayHeight } = event.nativeEvent.layout;
                setBoxes((prev) => prev[iso]?.top === top && prev[iso].height === dayHeight
                  ? prev : { ...prev, [iso]: { top, height: dayHeight } });
              }}
            >
              <View style={styles.dayHeader}>
                <AppText accessibilityRole="header" style={[styles.date, isToday && { color: palette.progress }]}>
                  {day.label}
                </AppText>
                <AppText tone="secondary" numberOfLines={1} style={styles.weekday}>
                  {isToday ? t("today") : day.weekday}
                </AppText>
                {holiday ? (
                  <AppText numberOfLines={1} accessibilityLabel={holiday.name}
                    style={[styles.holiday, { color: palette.chipText }]}>
                    {holiday.name}
                  </AppText>
                ) : null}
              </View>
              {items.length ? items.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => onOpenItem(item.source)}
                  style={styles.item}
                >
                  <AppText tabularNums tone="secondary" style={styles.time}>
                    {formatTimeRange(item.startTime, item.endTime) ?? t("all_day")}
                  </AppText>
                  <View style={[styles.bar, { backgroundColor: item.color.bar }]} />
                  <View style={styles.itemBody}>
                    <AppText numberOfLines={1} style={[styles.title, item.muted && styles.muted]}>{item.title}</AppText>
                    {item.meta ? <AppText tone="secondary" numberOfLines={1} style={styles.meta}>{item.meta}</AppText> : null}
                  </View>
                </Pressable>
              )) : <AppText tone="secondary" style={styles.weekday}>{t("timeline_day_empty")}</AppText>}
            </View>
          );
        }) : null}
        <View style={{ height: endSpace }} />
      </ScrollView>
      {!ready ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: palette.surface }]}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={styles.coverDay}>
              <Skeleton width={112} height={20} />
              <Skeleton width="85%" height={16} />
              <Skeleton width="70%" height={16} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  day: { paddingVertical: 12, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  dayHeader: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  date: { fontSize: 18, lineHeight: 24, fontWeight: "700" },
  weekday: { fontSize: 14, lineHeight: 19 },
  holiday: { flexShrink: 1, fontSize: 14, lineHeight: 19, opacity: 0.75 },
  item: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingVertical: 6, gap: 12 },
  time: { width: 64, fontSize: 12, lineHeight: 16 },
  bar: { width: 4, height: 16, borderRadius: 2 },
  itemBody: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, lineHeight: 21, fontWeight: "500" },
  muted: { textDecorationLine: "line-through", opacity: 0.7 },
  meta: { fontSize: 12, lineHeight: 16 },
  cover: { paddingTop: 12, gap: 12 },
  coverDay: { gap: 8, paddingBottom: 8 },
});
