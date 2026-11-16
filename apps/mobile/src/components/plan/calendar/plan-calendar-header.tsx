import { Pressable, StyleSheet, View } from "react-native";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import { formatDateLabel, formatMonthTitle } from "@mentor/core";
import { haptics } from "../../../lib/haptics.js";
import type { PlanCalendarScale } from "../../../lib/plan-calendar.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { SlidingTabs } from "../../ui/sliding-tabs.js";
import { AppText } from "../../ui/text.js";

export function PlanCalendarHeader({ scale, month, selectedDate, onScaleChange, onStep, onToday }: {
  scale: PlanCalendarScale;
  month: string;
  selectedDate: string;
  onScaleChange: (scale: PlanCalendarScale) => void;
  onStep: (direction: -1 | 1) => void;
  onToday: () => void;
}) {
  const { palette, radii } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("plan");
  const title = scale === "day"
    ? formatDateLabel(selectedDate, locale, t("today"), { alwaysFull: true })
    : scale === "month" ? formatMonthTitle(month, locale) : null;

  return (
    <View style={styles.header}>
      <View style={styles.row}>
        {title ? (
          <AppText accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.title}>
            {title}
          </AppText>
        ) : <View style={styles.spacer} />}
        <Pressable
          accessibilityRole="button"
          onPress={onToday}
          hitSlop={4}
          style={[styles.today, { backgroundColor: palette.surfaceAlt, borderRadius: radii.pill }]}
        >
          <AppText style={styles.todayLabel}>{t("go_today")}</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(`calendar_prev_${scale}`)}
          style={styles.arrow}
          onPress={() => { haptics.selection(); onStep(-1); }}
        >
          <AltArrowLeftIcon size={22} color={palette.main} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(`calendar_next_${scale}`)}
          style={styles.arrow}
          onPress={() => { haptics.selection(); onStep(1); }}
        >
          <AltArrowRightIcon size={22} color={palette.main} />
        </Pressable>
      </View>
      <SlidingTabs
        items={[
          { id: "day", label: t("calendar_scale_day") },
          { id: "week", label: t("calendar_scale_agenda") },
          { id: "month", label: t("calendar_scale_month") },
        ]}
        value={scale}
        onChange={onScaleChange}
        accessibilityLabel={t("calendar_scale_aria")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 2 },
  title: { flex: 1, fontSize: 16, fontWeight: "700" },
  spacer: { flex: 1 },
  today: { minHeight: 36, justifyContent: "center", paddingHorizontal: 12 },
  todayLabel: { fontSize: 14, fontWeight: "600" },
  arrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
