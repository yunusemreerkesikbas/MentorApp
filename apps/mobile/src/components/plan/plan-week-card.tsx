import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import { CalendarMinimalisticIcon } from "@solar-icons/react-native/linear/calendar-minimalistic";
import {
  formatDayNumber,
  formatWeekRangeLabel,
  taskStats,
  todayIso,
  weekDates,
} from "@mentor/core";
import type { PlanTaskDto } from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { PanelCard } from "../panel/primitives.js";
import { AppText } from "../ui/text.js";

const WEEKDAY_KEYS = [
  "week_mon",
  "week_tue",
  "week_wed",
  "week_thu",
  "week_fri",
  "week_sat",
  "week_sun",
] as const;

/** The web's `PlanDateNav` + `PlanWeekStrip` + day progress, in one card. */
export function PlanWeekCard({
  weekAnchor,
  selectedDate,
  weekTasks,
  onSelectDate,
  onShiftWeek,
  onOpenDatePicker,
  showDayProgress = true,
}: {
  weekAnchor: string;
  selectedDate: string;
  weekTasks: Record<string, PlanTaskDto[]>;
  onSelectDate: (iso: string) => void;
  /** Days to move the week by (±7); the screen applies it to its latest week. */
  onShiftWeek: (days: number) => void;
  onOpenDatePicker: () => void;
  /** Timeline hides the day's progress so nothing above its card moves while it scrolls. */
  showDayProgress?: boolean;
}) {
  const { palette } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("plan");
  const days = weekDates(weekAnchor);
  const today = todayIso();
  const day = taskStats(weekTasks[selectedDate] ?? []);

  return (
    <PanelCard style={styles.card}>
      <View style={styles.navRow}>
        <NavButton
          label={t("prev_week_aria")}
          onPress={() => onShiftWeek(-7)}
        >
          <AltArrowLeftIcon size={22} color={palette.main} />
        </NavButton>
        <AppText
          // Shrinks rather than clips: at 360 dp "28 Aralık 2026 – 3 Ocak 2027" needs ~194 dp of 146.
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={styles.range}
        >
          {formatWeekRangeLabel(days[0]!, days[6]!, locale)}
        </AppText>
        <NavButton label={t("calendar_aria")} onPress={onOpenDatePicker}>
          <CalendarMinimalisticIcon size={22} color={palette.main} />
        </NavButton>
        <NavButton
          label={t("next_week_aria")}
          onPress={() => onShiftWeek(7)}
        >
          <AltArrowRightIcon size={22} color={palette.main} />
        </NavButton>
      </View>

      <View style={styles.days}>
        {days.map((iso, index) => {
          const stats = taskStats(weekTasks[iso] ?? []);
          const selected = iso === selectedDate;
          const isToday = iso === today;
          const dotColor =
            stats.total === 0
              ? "transparent"
              : stats.percent === 100
                ? palette.success
                : palette.progress;
          return (
            <Pressable
              key={iso}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                haptics.selection();
                onSelectDate(iso);
              }}
              style={styles.day}
            >
              <AppText style={[styles.weekday, { color: palette.secondary }]}>
                {t(WEEKDAY_KEYS[index]!).toLocaleUpperCase(locale === "en" ? "en" : "tr")}
              </AppText>
              <View
                // Remounted on selection: Android keeps a square background when a rounded view's
                // fill changes from transparent to a colour in place (a day picked later drew a square).
                key={selected ? "selected" : "rest"}
                style={[
                  styles.dayCircle,
                  {
                    backgroundColor: selected ? palette.playSelected : "transparent",
                  },
                ]}
              >
                <AppText
                  style={[
                    isToday ? styles.dayNumberToday : styles.dayNumber,
                    { color: isToday ? palette.progress : palette.main },
                  ]}
                >
                  {formatDayNumber(iso)}
                </AppText>
              </View>
              <View
                // Remounted per colour, for the same Android square-fill reason.
                key={dotColor}
                style={[styles.dot, { backgroundColor: dotColor }]}
              />
            </Pressable>
          );
        })}
      </View>

      {showDayProgress && day.total > 0 ? (
        <View style={[styles.progress, { borderTopColor: palette.playLine }]}>
          <View style={styles.progressRow}>
            <AppText tabularNums style={styles.progressText}>
              {t("progress", { done: day.done, total: day.total })}
            </AppText>
            <AppText tabularNums tone="secondary" style={styles.progressText}>
              {t("progress_percent", { percent: day.percent })}
            </AppText>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: day.percent }}
            style={[styles.track, { backgroundColor: palette.progressTrack }]}
          >
            <View
              style={[styles.fill, { width: `${day.percent}%`, backgroundColor: palette.progress }]}
            />
          </View>
        </View>
      ) : null}
    </PanelCard>
  );
}

function NavButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
  range: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  days: {
    flexDirection: "row",
  },
  day: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  weekday: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "500",
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumber: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  dayNumberToday: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  progress: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    gap: 8,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
});
