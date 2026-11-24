import { StyleSheet, View } from "react-native";
import { parseNet } from "@mentor/core";
import type { WeeklyDeepAnalysisDto } from "@mentor/types";
import { mixHex } from "../../lib/layout.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { PanelCard, PanelCardTitle } from "../panel/primitives.js";
import { AppText } from "../ui/text.js";

const NOTE_TRENDS = new Set(["DOWN", "NO_EXAM", "EARLY"]);

export function RecapAnalysisRhythm({ metrics }: { metrics: WeeklyDeepAnalysisDto["metrics"] }) {
  const t = useTranslations("recapReport");
  const { palette } = useThemeTokens();
  const previousFill = mixHex(palette.progress, palette.playTrack, 0.6);
  if (!metrics.length) return null;

  return (
    <PanelCard style={styles.section}>
      <PanelCardTitle>{t("rhythm")}</PanelCardTitle>
      <View style={styles.legend}>
        <View style={styles.labelRow}>
          <View style={[styles.dot, { backgroundColor: previousFill }]} />
          <AppText variant="caption" tone="secondary">{t("legend_previous")}</AppText>
        </View>
        <View style={styles.labelRow}>
          <View style={[styles.dot, { backgroundColor: palette.progress }]} />
          <AppText variant="caption" tone="secondary">{t("legend_current")}</AppText>
        </View>
      </View>
      {metrics.map((metric) => {
        const label = t(`metric_${metric.id}`);
        const value = (count: number) => t(
          count === 1 ? `metric_value_${metric.id}_one` : `metric_value_${metric.id}`, { count },
        );
        const current = value(metric.current);
        const previous = metric.previous === null ? null : value(metric.previous);
        const max = Math.max(metric.current, metric.previous ?? 0, 1);
        return (
          <View key={metric.id} style={styles.entry}>
            <View style={styles.labelRow}>
              <AppText style={styles.label}>{label}</AppText>
              {metric.delta ? <RecapDelta delta={metric.delta} value={value(Math.abs(metric.delta))} /> : null}
              <AppText tabularNums variant="cardTitle">{current}</AppText>
            </View>
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={previous === null
                ? t("metric_aria_new", { label, current })
                : t("metric_aria", { label, current, previous })}
              style={styles.tracks}
            >
              {metric.previous !== null ? <Track ratio={metric.previous / max} color={previousFill} thin /> : null}
              <Track ratio={metric.current / max} color={palette.progress} />
            </View>
            <AppText variant="caption" tone="secondary">
              {previous === null ? t("previous_missing") : t("previous_value", { value: previous })}
            </AppText>
          </View>
        );
      })}
    </PanelCard>
  );
}

export function RecapAnalysisSubjects({ subjects }: { subjects: WeeklyDeepAnalysisDto["subjects"] }) {
  const t = useTranslations("recapReport");
  const { locale } = useLocale();
  const { palette } = useThemeTokens();
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const net = (value: number) => t("net", { net: number.format(value) });
  return (
    <PanelCard style={styles.section}>
      <View style={styles.entry}>
        <PanelCardTitle>{t("subjects")}</PanelCardTitle>
        <AppText variant="caption" tone="secondary">{t(subjects.length ? "subjects_hint" : "subjects_empty")}</AppText>
      </View>
      {subjects.map((subject) => {
        const current = parseNet(subject.averageNet);
        const previous = parseNet(subject.previousAverageNet);
        const delta = parseNet(subject.delta);
        const meta = [
          current === null ? null : t(subject.mockExamCount === 1 ? "subject_current_one" : "subject_current",
            { count: subject.mockExamCount }),
          previous !== null ? t(subject.previousMockExamCount === 1 ? "subject_previous_one" : "subject_previous",
            { net: net(previous), count: subject.previousMockExamCount })
            : current !== null ? t("subject_previous_missing") : null,
          subject.focusMinutes ? t("subject_focus", { minutes: subject.focusMinutes }) : null,
          subject.completedTaskCount ? t(subject.completedTaskCount === 1 ? "subject_tasks_one" : "subject_tasks",
            { count: subject.completedTaskCount }) : null,
        ].filter(Boolean).join(" · ");
        return (
          <View key={subject.subjectRef} style={[styles.subject, { borderColor: palette.border }]}>
            <View style={styles.labelRow}>
              <AppText style={styles.label}>{subject.subjectName}</AppText>
              {current === null ? <AppText variant="caption" tone="secondary">{t("no_attempt")}</AppText> : (
                <>
                  {delta ? <RecapDelta delta={delta} value={number.format(Math.abs(delta))} /> : null}
                  <AppText tabularNums variant="cardTitle">{net(current)}</AppText>
                </>
              )}
            </View>
            {meta ? <AppText variant="caption" tone="secondary">{meta}</AppText> : null}
            {NOTE_TRENDS.has(subject.trend) ? <AppText variant="caption">{subject.message}</AppText> : null}
          </View>
        );
      })}
    </PanelCard>
  );
}

export function RecapDelta({ delta, value }: { delta: number; value: string }) {
  const { palette } = useThemeTokens();
  return (
    <AppText tabularNums variant="caption" style={[
      styles.delta,
      { color: delta > 0 ? palette.success : palette.secondary,
        backgroundColor: delta > 0 ? mixHex(palette.success, palette.surface, 0.86) : palette.playTrack },
    ]}>
      {delta > 0 ? "+" : "−"}{value}
    </AppText>
  );
}

function Track({ ratio, color, thin = false }: { ratio: number; color: string; thin?: boolean }) {
  const { palette } = useThemeTokens();
  return (
    <View style={[styles.track, { height: thin ? 5 : 8, backgroundColor: palette.playTrack }]}>
      <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  entry: { gap: 6 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  labelRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  label: { flexGrow: 1, flexShrink: 1, fontWeight: "800" },
  dot: { height: 9, width: 9, borderRadius: 5 },
  tracks: { gap: 5 },
  track: { borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  subject: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 5 },
  delta: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, fontWeight: "800", overflow: "hidden" },
});
