import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { DAY_MINUTES, formatTimeRange, hhmmFromMinutes, isPastDate, layoutDayEvents } from "@mentor/core";
import type { PublicHolidayDto } from "@mentor/types";
import { mixHex } from "../../../lib/layout.js";
import {
  dayGridInitialOffset,
  PLAN_DAY_HOUR_HEIGHT,
  type PlanBoardItem,
} from "../../../lib/plan-calendar.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { Skeleton } from "../../ui/skeleton.js";
import { AppText } from "../../ui/text.js";

const HOURS = Array.from({ length: DAY_MINUTES / 60 }, (_, hour) => hhmmFromMinutes(hour * 60));
const GRID_HEIGHT = HOURS.length * PLAN_DAY_HOUR_HEIGHT;

interface PlanDayGridProps {
  date: string;
  items: PlanBoardItem[];
  holiday?: PublicHolidayDto;
  loading: boolean;
  onOpenItem: (source: PlanBoardItem["source"]) => void;
  onCreateAt: (date: string, startTime: string) => void;
}

export function PlanDayGrid({ loading, ...props }: PlanDayGridProps) {
  const height = useWindowDimensions().height * 0.6;
  return loading ? <Skeleton height={height} /> : <PlanDayHours {...props} height={height} />;
}

function PlanDayHours({ date, items, holiday, height, onOpenItem, onCreateAt }:
  Omit<PlanDayGridProps, "loading"> & { height: number }) {
  const { palette, radii } = useThemeTokens();
  const t = useTranslations("plan");
  const { allDay, timed } = useMemo(() => layoutDayEvents(items), [items]);
  // A date change remounts the grid. A refetch keeps the user's current scroll position.
  const [initialOffset] = useState(() => ({ x: 0, y: dayGridInitialOffset(items) }));
  const past = isPastDate(date);
  const divider = mixHex(palette.main, palette.surface, 0.08);

  return (
    <View>
      {holiday || allDay.length > 0 ? (
        <View style={[styles.allDay, { borderBottomColor: divider }]}>
          <AppText tone="secondary" style={styles.hourLabel}>
            {t("all_day")}
          </AppText>
          <View style={styles.allDayItems}>
            {holiday ? (
              <AppText
                style={[styles.holiday, {
                  color: palette.chipText,
                  backgroundColor: mixHex(palette.chipText, palette.surface, 0.1),
                }]}
              >
                {holiday.name}
              </AppText>
            ) : null}
            {allDay.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                onPress={() => onOpenItem(item.source)}
                style={[styles.allDayItem, {
                  borderRadius: radii.inner,
                  borderLeftColor: item.color.bar,
                  backgroundColor: item.color.bg,
                }]}
              >
                <AppText numberOfLines={1} style={[styles.itemTitle, item.muted && styles.muted]}>
                  {item.title}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <ScrollView nestedScrollEnabled style={{ height }} contentOffset={initialOffset}>
        <View style={styles.grid}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {HOURS.map((time) => (
              <AppText key={time} tabularNums tone="secondary" style={[styles.hourLabel, styles.hour]}>
                {time}
              </AppText>
            ))}
          </View>
          <View style={[styles.slots, { borderLeftColor: divider }]}>
            {HOURS.map((time) => {
              const style = [styles.slot, { borderTopColor: divider }];
              return past ? <View key={time} style={style} /> : (
                <Pressable
                  key={time}
                  accessibilityRole="button"
                  accessibilityLabel={t("calendar_add_at", { time })}
                  onPress={() => onCreateAt(date, time)}
                  style={({ pressed }) => [...style, pressed && { backgroundColor: palette.surfaceAlt }]}
                />
              );
            })}
            {timed.map(({ event, topPct, heightPct, col, colCount }) => {
              const blockHeight = (heightPct / 100) * GRID_HEIGHT;
              const extraTouch = Math.max(0, (44 - blockHeight) / 2);
              const time = formatTimeRange(event.startTime, event.endTime);
              return (
                <Pressable
                  key={event.id}
                  accessibilityRole="button"
                  accessibilityLabel={time ? event.title + ", " + time : event.title}
                  hitSlop={{ top: extraTouch, bottom: extraTouch }}
                  onPress={() => onOpenItem(event.source)}
                  style={[styles.block, {
                    top: (topPct / 100) * GRID_HEIGHT,
                    height: blockHeight,
                    left: `${col / colCount * 100}%`,
                    right: `${(colCount - col - 1) / colCount * 100}%`,
                    backgroundColor: event.color.bg,
                    borderLeftColor: event.color.bar,
                  }]}
                >
                  <AppText numberOfLines={1} style={[styles.itemTitle, event.muted && styles.muted]}>
                    {event.title}
                  </AppText>
                  {time && blockHeight >= 42 ? (
                    <AppText numberOfLines={1} tabularNums tone="secondary" style={styles.itemTime}>{time}</AppText>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  allDay: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  allDayItems: { flex: 1, minWidth: 0, gap: 4, paddingLeft: 4 },
  allDayItem: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
    borderLeftWidth: 2,
  },
  holiday: { fontSize: 12, lineHeight: 16, padding: 6, borderRadius: 6 },
  grid: { flexDirection: "row", height: GRID_HEIGHT },
  hourLabel: { width: 48, paddingRight: 5, textAlign: "right", fontSize: 11, lineHeight: 16 },
  hour: { height: PLAN_DAY_HOUR_HEIGHT, paddingTop: 2 },
  slots: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth },
  slot: { height: PLAN_DAY_HOUR_HEIGHT, borderTopWidth: StyleSheet.hairlineWidth },
  block: {
    position: "absolute",
    marginHorizontal: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderLeftWidth: 2,
    overflow: "hidden",
  },
  itemTitle: { fontSize: 13, lineHeight: 17, fontWeight: "700" },
  itemTime: { fontSize: 11, lineHeight: 15 },
  muted: { textDecorationLine: "line-through", opacity: 0.7 },
});
