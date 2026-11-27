import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { AltArrowDownIcon } from "@solar-icons/react-native/linear/alt-arrow-down";
import { AltArrowUpIcon } from "@solar-icons/react-native/linear/alt-arrow-up";
import { ArrowRightDownIcon } from "@solar-icons/react-native/linear/arrow-right-down";
import { ArrowRightUpIcon } from "@solar-icons/react-native/linear/arrow-right-up";
import { InfoCircleIcon } from "@solar-icons/react-native/linear/info-circle";
import { MenuDotsIcon } from "@solar-icons/react-native/linear/menu-dots";
import { formatNet, formatTrendDate } from "@mentor/core";
import type { CoachingAnalysisDto, MockExamDto } from "@mentor/types";
import { deleteMockExam } from "../../lib/analysis-api.js";
import { haptics } from "../../lib/haptics.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { ActionSheet, PanelCard, PanelCardTitle, ProgressLine } from "../panel/primitives.js";
import { AppText, Chip, Skeleton } from "../ui/index.js";
import { AnalysisLink } from "./analysis-link.js";

export function AnalysisSubjectsCard({ analysis }: { analysis: CoachingAnalysisDto }) {
  const { locale } = useLocale();
  const t = useTranslations("analysisSubjects");
  const tCommon = useTranslations("common");
  const { palette, space, touchTargets } = useThemeTokens();
  if (analysis.subjects.length === 0) return null;

  return (
    <PanelCard style={{ gap: space.md }}>
      <View style={styles.spread}>
        <PanelCardTitle>{t("title")}</PanelCardTitle>
        <Pressable accessibilityRole="button" accessibilityLabel={t("caption")}
          onPress={() => Alert.alert(t("caption"), t("info"), [{ text: tCommon("close") }])}
          style={[styles.inline, { minHeight: touchTargets.min, gap: space.xs }]}>
          <AppText variant="caption" tone="secondary" numberOfLines={1}>{t("caption")}</AppText>
          <InfoCircleIcon size={15} color={palette.secondary} />
        </Pressable>
      </View>
      {analysis.subjects.map((subject) => {
        const delta = Number(subject.netDelta ?? 0);
        const DeltaIcon = delta > 0 ? ArrowRightUpIcon : ArrowRightDownIcon;
        const percent = subject.normalizedAveragePercent == null ? null : Math.round(Number(subject.normalizedAveragePercent));
        return (
          <View key={subject.subjectRef} style={{ gap: space.sm }}>
            <View style={[styles.inline, { gap: space.sm }]}>
              <View style={[styles.inline, { flex: 1, flexWrap: "wrap", gap: space.xs }]}>
                <AppText variant="caption" style={styles.bold}>{subject.subjectName}</AppText>
                {subject.subjectRef === analysis.nextFocus?.subjectRef ? <Chip label={t("focus")} /> : null}
              </View>
              {Math.abs(delta) >= 0.05 ? (
                <View style={styles.inline} accessible accessibilityLabel={`${t("trend_aria")}: ${formatNet(delta, locale)}`}>
                  <DeltaIcon size={14} color={delta > 0 ? palette.success : palette.secondary} />
                  <AppText variant="caption" tone={delta > 0 ? "success" : "secondary"} tabularNums>
                    {delta > 0 ? "+" : ""}{formatNet(delta, locale)}
                  </AppText>
                </View>
              ) : null}
              <AppText variant="caption" tabularNums style={styles.bold}>
                {formatNet(subject.averageNet, locale)}
                {subject.questionCount != null ? <AppText variant="caption" tone="secondary"> / {subject.questionCount}</AppText> : null}
              </AppText>
            </View>
            {percent != null ? <ProgressLine value={percent} max={100}
              label={t("bar_label", { subject: subject.subjectName, percent })} /> : null}
          </View>
        );
      })}
    </PanelCard>
  );
}

export function AnalysisHistoryCard({
  items, loading, error, hasMore, onMore, onRefresh, onCoach, onMistakes, onEdit,
}: {
  items: MockExamDto[];
  loading: boolean;
  error: boolean;
  hasMore: boolean;
  onMore: () => void;
  onRefresh: () => Promise<void>;
  onCoach: (id: string, seed: string) => void;
  onMistakes: (id: string) => void;
  onEdit: (item: MockExamDto) => void;
}) {
  const t = useTranslations("analysisHistory");
  const tAnalysis = useTranslations("analysis");
  const tCommon = useTranslations("common");
  const { locale } = useLocale();
  const { palette, radii, space, touchTargets } = useThemeTokens();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [menu, setMenu] = useState<MockExamDto | null>(null);
  const deletion = useMutation({
    mutationFn: deleteMockExam,
    onSuccess: async () => {
      setExpanded(null);
      haptics.success();
      await onRefresh();
    },
    onError: (cause) => Alert.alert(tCommon("error_title"), cause instanceof Error ? cause.message : tCommon("error_body")),
  });
  const confirmDelete = (item: MockExamDto) => {
    if (deletion.isPending) return;
    Alert.alert(t("delete_confirm_title"), t("delete_confirm_message", {
      name: item.publisherName ?? item.examName, date: formatTrendDate(item.takenAt, locale),
    }), [
      { text: t("delete_confirm_no"), style: "cancel" },
      { text: t("delete_confirm_yes"), style: "destructive", onPress: () => deletion.mutate(item.id) },
    ], { cancelable: true });
  };

  return (
    <PanelCard style={{ gap: space.sm }}>
      <View style={styles.spread}>
        <PanelCardTitle>{t("title")}</PanelCardTitle>
        {items.length ? <AppText variant="caption" tone="secondary">{t(items.length === 1 ? "count_one" : "count", { count: items.length })}</AppText> : null}
      </View>
      {items.length === 0 && !error ? loading ? <Skeleton height={44} /> : (
        <AppText tone="secondary">{t("empty")}</AppText>
      ) : null}
      {items.map((item, index) => {
        const opened = expanded === item.id;
        const date = formatTrendDate(item.takenAt, locale);
        const name = item.publisherName ?? item.examName;
        const Arrow = opened ? AltArrowUpIcon : AltArrowDownIcon;
        return (
          <View key={item.id} style={{ borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0, borderColor: palette.border }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: opened }} onPress={() => setExpanded(opened ? null : item.id)}
              style={[styles.inline, { minHeight: touchTargets.comfortable, gap: space.sm, paddingVertical: space.sm }]}>
              <View style={{ flex: 1 }}>
                <AppText variant="caption" style={styles.bold}>{name}</AppText>
                <AppText variant="micro" tone="secondary">{date}</AppText>
              </View>
              <AppText variant="caption" tabularNums style={styles.bold}>{tAnalysis("net_suffix", { net: formatNet(item.totalNet, locale) })}</AppText>
              <Arrow size={18} color={palette.secondary} />
            </Pressable>
            {opened ? (
              <View style={{ backgroundColor: palette.surfaceAlt, borderRadius: radii.inner, padding: space.md, gap: space.sm }}>
                {item.subjects.filter((subject) => subject.correct || subject.wrong || subject.blank).map((subject) => (
                  <View key={subject.subjectRef} style={[styles.spread, { gap: space.sm }]}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="caption" style={styles.bold}>{subject.subjectName}</AppText>
                      <AppText variant="micro" tone="secondary">{t("row_counts", { correct: subject.correct, wrong: subject.wrong, blank: subject.blank })}</AppText>
                    </View>
                    <AppText variant="caption" tabularNums>{tAnalysis("net_suffix", { net: formatNet(subject.net, locale) })}</AppText>
                  </View>
                ))}
                <View style={styles.spread}>
                  <AnalysisLink label={t("open_mistakes")} onPress={() => onMistakes(item.id)} style={{ flex: 1 }} />
                  <Pressable accessibilityRole="button" accessibilityLabel={t("more_actions")} onPress={() => setMenu(item)}
                    style={{ minWidth: touchTargets.min, minHeight: touchTargets.min, alignItems: "center", justifyContent: "center" }}>
                    <MenuDotsIcon size={22} color={palette.secondary} />
                  </Pressable>
                </View>
                <AnalysisLink label={tAnalysis("ask_puhu_cta")}
                  onPress={() => onCoach(item.id, t("coach_seed", { date, exam: name }))} />
              </View>
            ) : null}
          </View>
        );
      })}
      {error ? <AnalysisLink label={tCommon("retry")} onPress={() => void onRefresh()} /> : null}
      {hasMore ? <AnalysisLink label={t("load_more")} onPress={onMore} /> : null}
      <ActionSheet title={menu ? menu.publisherName ?? menu.examName : null} onClose={() => setMenu(null)}
        actions={menu ? [
          { label: t("edit"), onPress: () => onEdit(menu) },
          { label: t("delete"), tone: "danger", onPress: () => confirmDelete(menu) },
        ] : []} />
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: "row", alignItems: "center" },
  spread: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bold: { fontWeight: "800" },
});
