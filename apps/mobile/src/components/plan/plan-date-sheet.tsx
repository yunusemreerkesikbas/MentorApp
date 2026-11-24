import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import {
  formatDayNumber,
  formatMonthTitle,
  monthIsoBounds,
  monthStart,
  shiftMonth,
  todayIso,
} from "@mentor/core";
import { listPlanTaskCalendarDates } from "../../lib/coaching-api.js";
import { haptics } from "../../lib/haptics.js";
import { monthGridWeeks } from "../../lib/plan-view.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { FormSheet } from "../panel/primitives.js";
import { Button } from "../ui/button.js";
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

/**
 * "Tarih seç": the web's plan date sheet. A Monday-first month with dots on days that hold a task.
 * Mount it while open; it starts from `initialDate` each time.
 */
export function PlanDateSheet({
  visible,
  initialDate,
  onApply,
  onClose,
}: {
  visible: boolean;
  initialDate: string;
  onApply: (iso: string) => void;
  onClose: () => void;
}) {
  const { palette, radii } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const [selected, setSelected] = useState(initialDate);
  const [month, setMonth] = useState(() => monthStart(initialDate));

  const { from, to } = monthIsoBounds(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1);
  // Best-effort, like the web: no dots is better than an error inside a picker.
  const datesQuery = useQuery({
    queryKey: ["plan-tasks", "calendar", from, to],
    queryFn: () => listPlanTaskCalendarDates(from, to),
    retry: false,
  });
  const planned = new Set(datesQuery.data ?? []);
  const today = todayIso();

  return (
    <FormSheet
      visible={visible}
      title={t("date_sheet_title")}
      closeLabel={tCommon("close")}
      onClose={onClose}
      footer={<Button label={t("date_sheet_apply")} onPress={() => onApply(selected)} />}
    >
      <View style={[styles.box, { borderColor: palette.border, borderRadius: radii.inner }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptics.selection();
            setSelected(today);
            setMonth(monthStart(today));
          }}
          style={[styles.todayChip, { backgroundColor: palette.playSelected }]}
        >
          <AppText style={[styles.todayLabel, { color: palette.playSelectedInk }]}>
            {t("today")}
          </AppText>
        </Pressable>

        <View style={styles.monthRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={formatMonthTitle(shiftMonth(month, -1, 1), locale)}
            onPress={() => setMonth(shiftMonth(month, -1, 1))}
            style={styles.monthButton}
          >
            <AltArrowLeftIcon size={22} color={palette.main} />
          </Pressable>
          <AppText style={styles.monthTitle}>{formatMonthTitle(month, locale)}</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={formatMonthTitle(shiftMonth(month, 1, 1), locale)}
            onPress={() => setMonth(shiftMonth(month, 1, 1))}
            style={styles.monthButton}
          >
            <AltArrowRightIcon size={22} color={palette.main} />
          </Pressable>
        </View>

        <View style={styles.row}>
          {WEEKDAY_KEYS.map((key) => (
            <AppText key={key} style={[styles.weekday, { color: palette.secondary }]}>
              {t(key)}
            </AppText>
          ))}
        </View>

        {/* One row per week: a wrapped grid of 1/7 widths rounds past the row at 2.625 density
            and fits six cells, so every week slid a column. */}
        {monthGridWeeks(month).map((week) => (
          <View key={week[0]} style={styles.row}>
            {week.map((iso) => {
              const isSelected = iso === selected;
              const outside = iso.slice(0, 7) !== month.slice(0, 7);
              // Remounted per colour, for the same Android square-fill reason as the circle.
              const dotColor = !planned.has(iso)
                ? "transparent"
                : isSelected
                  ? palette.ctaPlayInk
                  : palette.progress;
              return (
                <Pressable
                  key={iso}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    haptics.selection();
                    setSelected(iso);
                    if (outside) setMonth(monthStart(iso));
                  }}
                  style={styles.cell}
                >
                  <View
                    // Remounted on selection: Android keeps a square background when a rounded view's
                    // fill changes from transparent to a colour in place.
                    key={isSelected ? "selected" : "rest"}
                    style={[
                      styles.circle,
                      {
                        backgroundColor: isSelected ? palette.ctaPlayBg : "transparent",
                      },
                    ]}
                  >
                    <AppText
                      tabularNums
                      style={[
                        styles.dayNumber,
                        {
                          color: isSelected
                            ? palette.ctaPlayInk
                            : outside
                              ? palette.muted
                              : iso === today
                                ? palette.progress
                                : palette.main,
                        },
                      ]}
                    >
                      {formatDayNumber(iso)}
                    </AppText>
                    <View key={dotColor} style={[styles.dot, { backgroundColor: dotColor }]} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  todayChip: {
    alignSelf: "flex-start",
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    justifyContent: "center",
  },
  todayLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  monthButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  cell: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumber: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "600",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
