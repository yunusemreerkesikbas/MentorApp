import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Polygon, Polyline, Text as SvgText } from "react-native-svg";
import { ArrowRightDownIcon } from "@solar-icons/react-native/linear/arrow-right-down";
import { ArrowRightUpIcon } from "@solar-icons/react-native/linear/arrow-right-up";
import { StarIcon } from "@solar-icons/react-native/bold/star";
import { formatShortDate, trendForSparkline } from "@mentor/core";
import type { CoachingAnalysisDto, MockExamTrendPointDto } from "@mentor/types";
import { mixHex } from "../../lib/layout.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { FormSheet, PanelCard, PanelCardTitle } from "../panel/primitives.js";
import { AppText } from "../ui/index.js";
import { AnalysisLink } from "./analysis-link.js";

export function AnalysisNetCard({ analysis }: { analysis: CoachingAnalysisDto }) {
  const t = useTranslations("analysisNet");
  const { palette, radii, space } = useThemeTokens();
  const points = trendForSparkline(analysis.trend);
  const latest = analysis.trend[0];
  if (!latest) return null;

  const ghost = analysis.ghost;
  const delta = Number(ghost?.previousDelta ?? 0);
  const DeltaIcon = delta > 0 ? ArrowRightUpIcon : ArrowRightDownIcon;

  return (
    <PanelCard style={{ gap: space.md }}>
      <View style={styles.spread}>
        <PanelCardTitle>{t("title")}</PanelCardTitle>
        <AppText variant="caption" tone="secondary">{t(points.length === 1 ? "count_one" : "count", { count: points.length })}</AppText>
      </View>
      <View style={[styles.inline, { flexWrap: "wrap", gap: space.sm }]}>
        <AppText variant="display" tabularNums style={styles.heavy}>{latest.totalNet}</AppText>
        <AppText variant="caption" tone="secondary" style={styles.bold}>{t("unit")}</AppText>
        {ghost ? <>
          <View style={styles.inline}>
            {delta !== 0 ? <DeltaIcon size={16} color={delta > 0 ? palette.success : palette.secondary} /> : null}
            <AppText variant="caption" tabularNums tone={delta > 0 ? "success" : "secondary"} style={styles.bold}>{ghost.previousDelta}</AppText>
          </View>
          <AppText variant="caption" tone="secondary">{t("delta_caption")}</AppText>
        </> : null}
      </View>
      {ghost?.isNewRecord ? (
        <View style={[styles.inline, {
          alignSelf: "flex-start", borderRadius: radii.pill, gap: space.xs,
          paddingHorizontal: space.sm, paddingVertical: space.xs,
          backgroundColor: mixHex(palette.star, palette.surface, 0.22),
        }]}>
          <StarIcon size={14} color={palette.star} />
          <AppText variant="caption" style={[styles.bold, { flexShrink: 1 }]}>{t("new_record")}</AppText>
        </View>
      ) : ghost && analysis.personalRecordNet ? (
        <AppText variant="caption" tone="secondary">{t("record", { value: analysis.personalRecordNet })}</AppText>
      ) : null}
      {points.length > 1 ? <NetChart points={points} record={analysis.personalRecordNet} /> : (
        <AppText variant="caption" tone="secondary">{t("first")}</AppText>
      )}
    </PanelCard>
  );
}

const CHART_HEIGHT = 174;

function NetChart({ points, record }: { points: MockExamTrendPointDto[]; record: string | null }) {
  const { locale } = useLocale();
  const t = useTranslations("analysisNet");
  const tCommon = useTranslations("common");
  const { palette, space } = useThemeTokens();
  const [width, setWidth] = useState(0);
  const [showValues, setShowValues] = useState(false);
  const values = points.map((point) => Number(point.totalNet));
  const max = Math.max(...values, record == null ? -Infinity : Number(record));
  const min = Math.floor(Math.min(...values));
  const span = Math.max(max - min, 1);
  const pad = space.sm;
  const axis = space.xl;
  const tickStep = Math.max(1, Math.ceil(span / 4));
  const ticks = Array.from({ length: Math.floor(span / tickStep) + 1 }, (_, index) => min + index * tickStep);
  const y = (value: number) => CHART_HEIGHT - pad - (pad + (value - min) / span * (CHART_HEIGHT - pad * 4));
  const positions = values.map((value, index) => ({
    x: axis + index / (values.length - 1) * (width - axis - pad),
    y: y(value),
  }));
  const line = positions.map((point) => `${point.x},${point.y}`).join(" ");
  const chartLabel = t("chart_label", { count: points.length });

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={chartLabel} accessibilityHint={t("table_caption")}
        onPress={() => setShowValues(true)} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > axis + pad ? (
          <Svg accessible={false} width={width} height={CHART_HEIGHT}>
            {ticks.map((tick) => (
              <Line key={`grid-${tick}`} x1={axis} x2={width - pad} y1={y(tick)} y2={y(tick)} stroke={palette.border} strokeWidth={1} />
            ))}
            {ticks.map((tick) => (
              <SvgText key={`axis-${tick}`} x={axis - pad} y={y(tick) + 4} textAnchor="end" fontSize={11} fill={palette.secondary}>
                {tick}
              </SvgText>
            ))}
            <Polygon points={`${axis},${CHART_HEIGHT - pad} ${line} ${width - pad},${CHART_HEIGHT - pad}`}
              fill={palette.ctaPlayBg} opacity={0.1} />
            {record != null ? <>
              <Line x1={axis} x2={width - pad} y1={y(Number(record))} y2={y(Number(record))}
                stroke={palette.muted} strokeDasharray="4 4" opacity={0.72} />
              <SvgText x={width - pad} y={y(Number(record)) - pad} textAnchor="end" fontSize={11} fill={palette.secondary}>
                {t("record_marker")}
              </SvgText>
            </> : null}
            <Polyline points={line} stroke={palette.ctaPlayEdge} strokeWidth={3} fill="none" strokeLinejoin="round" />
            {positions.map((point, index) => (
              <Circle key={points[index]?.id} cx={point.x} cy={point.y} r={4} fill={palette.surface}
                stroke={palette.ctaPlayEdge} strokeWidth={2} />
            ))}
          </Svg>
        ) : <View style={{ height: CHART_HEIGHT }} />}
        <View style={[styles.spread, { paddingLeft: axis, paddingRight: pad }]}>
          <AppText variant="micro" tone="secondary">{formatShortDate(points[0]!.takenAt, locale)}</AppText>
          <AppText variant="micro" tone="secondary">{formatShortDate(points[points.length - 1]!.takenAt, locale)}</AppText>
        </View>
      </Pressable>
      {showValues ? (
        <FormSheet visible title={t("table_caption")} closeLabel={tCommon("close")} onClose={() => setShowValues(false)}>

          {points.map((point) => (
            <View key={point.id} style={[styles.spread, { paddingVertical: space.xs }]}>
              <AppText variant="caption" tone="secondary">{formatShortDate(point.takenAt, locale)}</AppText>
              <AppText variant="caption" tabularNums>{point.totalNet} {t("unit")}</AppText>
            </View>
          ))}
          <AnalysisLink label={tCommon("close")} onPress={() => setShowValues(false)} />
        </FormSheet>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: "row", alignItems: "center" },
  spread: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bold: { fontWeight: "800" },
  heavy: { fontWeight: "900" },
});
