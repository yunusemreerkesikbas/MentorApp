import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { SnowflakeIcon } from "@solar-icons/react-native/bold/snowflake";
import { formatWeekdayShort, todayIso } from "@mentor/core";
import type { FocusGoalDto, StreakWeekDayDto } from "@mentor/types";
import { art } from "../../lib/art.js";
import { mixHex } from "../../lib/layout.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/text.js";

type DayState = "active" | "frozen" | "idle" | "future";

/**
 * This week, Monday to Sunday, as the streak walk saw it (the web's `WeekBand`). A frozen day
 * reads as kept, not missed; days after today are "not yet", never failures.
 */
export function WeekBand({
  week,
  streak,
  focusGoal,
}: {
  week: StreakWeekDayDto[];
  streak: number;
  focusGoal: FocusGoalDto;
}) {
  const t = useTranslations("panel");
  const { locale } = useLocale();
  const { palette } = useThemeTokens();
  const today = todayIso();

  const goalLine =
    focusGoal.goalMinutes != null
      ? t("week_goal", { done: focusGoal.focusMinutesToday, goal: focusGoal.goalMinutes })
      : focusGoal.focusMinutesToday > 0
        ? t("week_focus", { minutes: focusGoal.focusMinutesToday })
        : null;

  return (
    <View
      style={[
        styles.band,
        {
          borderTopColor: palette.playLine,
          backgroundColor: mixHex(palette.playTrack, palette.surface, 0.35),
        },
      ]}
    >
      <View style={styles.days}>
        {week.map((day) => {
          const state: DayState = day.active
            ? "active"
            : day.frozen
              ? "frozen"
              : day.date > today
                ? "future"
                : "idle";
          const isToday = day.date === today;
          return (
            <View key={day.date} style={styles.day}>
              <View
                style={[
                  styles.dot,
                  state === "active" && { backgroundColor: palette.streakSoft },
                  state === "frozen" && {
                    backgroundColor: mixHex(palette.progress, palette.surface, 0.18),
                  },
                  state === "idle" && { backgroundColor: palette.playTrack },
                  state === "future" && [styles.dotFuture, { borderColor: palette.playLine }],
                  isToday && [styles.dotToday, { borderColor: palette.streak }],
                ]}
              >
                {state === "frozen" ? (
                  <SnowflakeIcon size={14} color={palette.playSelectedInk} />
                ) : (
                  <Image
                    source={art.flame}
                    style={[styles.flame, state !== "active" && styles.flameQuiet]}
                    // The web greys an unlit flame; a flat tint is the closest native equivalent.
                    tintColor={state === "active" ? undefined : palette.muted}
                    contentFit="contain"
                  />
                )}
              </View>
              <AppText
                style={[styles.dayLabel, { color: isToday ? palette.streak : palette.secondary }]}
              >
                {formatWeekdayShort(day.date, locale)}
              </AppText>
            </View>
          );
        })}
      </View>

      <View style={styles.summary}>
        <View style={styles.streakRow}>
          <Image source={art.flame} style={styles.streakFlame} contentFit="contain" />
          <AppText tabularNums style={styles.streakText}>
            {streak === 0 ? t("week_streak_zero") : t("week_streak_days", { count: streak })}
          </AppText>
        </View>
        {goalLine ? (
          <AppText tabularNums style={[styles.goal, { color: palette.secondary }]}>
            {goalLine}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Wraps on a phone: the summary drops under the days instead of squeezing them.
  band: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
    rowGap: 8,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  days: {
    flexDirection: "row",
    gap: 4,
  },
  day: {
    width: 28,
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dotFuture: {
    borderWidth: 2,
    borderStyle: "dashed",
  },
  dotToday: {
    borderWidth: 2,
    borderStyle: "solid",
  },
  flame: {
    width: 14,
    height: 14,
  },
  flameQuiet: {
    opacity: 0.35,
  },
  dayLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },
  summary: {
    marginLeft: "auto",
    alignItems: "flex-end",
    gap: 2,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  streakFlame: {
    width: 18,
    height: 18,
  },
  streakText: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },
  goal: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
});
