import { Pressable, StyleSheet, View } from "react-native";
import {
  formatDayNumber,
  formatWeekdayShort,
  formatWeekRangeLabel,
  todayIso,
  weekCompletionStats,
  weekDates,
} from "@mentor/core";
import type { PlanTaskDto } from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Card, Chip } from "../ui/index.js";

export interface WeekStripProps {
  weekAnchor: string;
  selectedDate: string;
  weekTasks: Record<string, PlanTaskDto[]>;
  onSelectDate: (iso: string) => void;
  onShiftWeek: (deltaWeeks: -1 | 1) => void;
  onJumpToday: () => void;
}

export function WeekStrip({
  weekAnchor,
  selectedDate,
  weekTasks,
  onSelectDate,
  onShiftWeek,
  onJumpToday,
}: WeekStripProps) {
  const { locale } = useLocale();
  const t = useTranslations("plan");
  const { palette, radii, space, touchTargets } = useThemeTokens();

  const days = weekDates(weekAnchor);
  const weekEnd = days[days.length - 1] ?? weekAnchor;
  const today = todayIso();
  const stats = weekCompletionStats(weekTasks, weekAnchor);

  return (
    <Card style={{ gap: space.md }}>
      <View style={styles.navRow}>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            haptics.selection();
            onShiftWeek(-1);
          }}
          style={[
            styles.navBtn,
            {
              minHeight: touchTargets.min,
              borderColor: palette.border,
              backgroundColor: palette.surfaceAlt,
              borderRadius: radii.pill,
              paddingHorizontal: space.md,
            },
          ]}
        >
          <AppText variant="caption">‹ {t("prev_week")}</AppText>
        </Pressable>

        <View style={{ alignItems: "center", flex: 1 }}>
          <AppText variant="cardTitle">
            {formatWeekRangeLabel(weekAnchor, weekEnd, locale)}
          </AppText>
          {stats.total > 0 ? (
            <AppText variant="micro" tone="muted" tabularNums>
              {t("week_progress", {
                percent: stats.percent,
                done: stats.done,
                total: stats.total,
              })}
            </AppText>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            haptics.selection();
            onShiftWeek(1);
          }}
          style={[
            styles.navBtn,
            {
              minHeight: touchTargets.min,
              borderColor: palette.border,
              backgroundColor: palette.surfaceAlt,
              borderRadius: radii.pill,
              paddingHorizontal: space.md,
            },
          ]}
        >
          <AppText variant="caption">{t("next_week")} ›</AppText>
        </Pressable>
      </View>

      {selectedDate !== today ? (
        <View style={{ alignSelf: "center" }}>
          <Chip label={t("today_cta")} onPress={onJumpToday} tone="coach" />
        </View>
      ) : null}

      <View style={styles.daysRow}>
        {days.map((iso) => {
          const isSelected = iso === selectedDate;
          const isToday = iso === today;
          const dayList = weekTasks[iso] ?? [];
          const hasTasks = dayList.length > 0;
          const allDone =
            hasTasks && dayList.every((item) => item.status === "DONE");

          return (
            <Pressable
              key={iso}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => {
                haptics.selection();
                onSelectDate(iso);
              }}
              style={[
                styles.dayPill,
                {
                  minHeight: touchTargets.min + 12,
                  borderRadius: radii.inner,
                  borderColor: isSelected
                    ? palette.ctaPlayEdge
                    : isToday
                      ? palette.accent
                      : palette.border,
                  backgroundColor: isSelected
                    ? palette.ctaPlayBg
                    : palette.surfaceAlt,
                  paddingVertical: space.xs + 2,
                },
              ]}
            >
              <AppText
                variant="micro"
                style={{
                  color: isSelected ? palette.ctaPlayInk : palette.secondary,
                }}
              >
                {formatWeekdayShort(iso, locale)}
              </AppText>
              <AppText
                variant="cardTitle"
                tabularNums
                style={{
                  color: isSelected ? palette.ctaPlayInk : palette.main,
                }}
              >
                {formatDayNumber(iso)}
              </AppText>
              <View
                style={[
                  styles.taskDot,
                  {
                    backgroundColor: !hasTasks
                      ? "transparent"
                      : allDone
                        ? palette.success
                        : isSelected
                          ? palette.ctaPlayInk
                          : palette.accent,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  navBtn: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  dayPill: {
    flex: 1,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  taskDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
});
