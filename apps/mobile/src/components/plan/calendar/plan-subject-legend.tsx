import { Pressable, StyleSheet, View } from "react-native";
import { formatDateLabel, formatPlannedMinutes, planEventSwatch, summarizeSubjectMonth, todayIso } from "@mentor/core";
import type { PlanTaskDto } from "@mentor/types";
import { mixHex } from "../../../lib/layout.js";
import { legendSubjects, planEventTint } from "../../../lib/plan-calendar.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { AppText } from "../../ui/text.js";

export function PlanSubjectLegend({ monthKey, tasksByDate, active, onSelect }: {
  monthKey: string;
  tasksByDate: Record<string, PlanTaskDto[]>;
  active: string | null;
  onSelect: (subject: string | null) => void;
}) {
  const { palette, radii } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("plan");
  const subjects = legendSubjects(tasksByDate, monthKey);
  if (subjects.length === 0) return null;

  const summary = active ? summarizeSubjectMonth(active, tasksByDate, monthKey, todayIso()) : null;
  const summaryLine = summary && summary.total > 0 ? [
    t("legend_progress", { done: summary.done, total: summary.total }),
    t(summary.dayCount === 1 ? "legend_days_one" : "legend_days_other", { count: summary.dayCount }),
    summary.plannedMinutes === null ? null : formatPlannedMinutes(summary.plannedMinutes, {
      hour: t("legend_hour_short"), minute: t("legend_minute_short"),
    }),
    summary.next ? t("legend_next_short", {
      date: formatDateLabel(summary.next.date, locale, t("today"), { compact: true }),
    }) : null,
  ].filter(Boolean).join(" · ") : null;

  return (
    <View
      accessibilityLabel={t("calendar_legend_aria")}
      style={[styles.legend, { borderTopColor: mixHex(palette.main, palette.surface, 0.08) }]}
    >
      {subjects.map(({ subject, count }) => {
        const color = planEventTint(planEventSwatch(subject), palette);
        const selected = active === subject;
        return (
          <Pressable
            key={subject}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(selected ? null : subject)}
            style={[styles.pill, {
              borderRadius: radii.pill,
              opacity: active !== null && !selected ? 0.45 : 1,
            }, selected && styles.lift]}
          >
            <View
              key={selected ? "selected" : "rest"}
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.pillFill, {
                borderRadius: radii.pill,
                borderColor: selected ? color.bar : palette.border,
                backgroundColor: selected ? color.bg : palette.surface,
                boxShadow: selected ? "0px 4px 12px " + color.bar + "52" : undefined,
              }]}
            />
            <View style={[styles.subjectBar, { backgroundColor: color.bar }]} />
            <AppText numberOfLines={1} style={[styles.text, styles.subject]}>{subject}</AppText>
            <AppText tone="secondary" tabularNums style={styles.text}>{count}</AppText>
          </Pressable>
        );
      })}
      {active ? (
        <Pressable accessibilityRole="button" onPress={() => onSelect(null)} style={styles.clear}>
          <AppText style={[styles.text, { color: palette.progress, fontWeight: "600" }]}>
            {t("calendar_legend_clear")}
          </AppText>
        </Pressable>
      ) : null}
      {summaryLine ? <AppText tone="secondary" style={[styles.text, styles.summary]}>{summaryLine}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  pill: { maxWidth: "100%", flexDirection: "row", alignItems: "center", minHeight: 36, paddingHorizontal: 10, gap: 6 },
  pillFill: { borderWidth: 1 },
  lift: { transform: [{ translateY: -1 }] },
  subject: { flexShrink: 1 },
  subjectBar: { width: 4, height: 12, borderRadius: 2 },
  text: { fontSize: 12, lineHeight: 17 },
  clear: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  summary: { width: "100%", paddingTop: 4 },
});
