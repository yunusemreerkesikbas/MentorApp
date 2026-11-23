import { Pressable, StyleSheet, View } from "react-native";
import { CheckCircleIcon } from "@solar-icons/react-native/bold/check-circle";
import { RestartIcon } from "@solar-icons/react-native/bold/restart";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchNotebookReviewHistory, type MistakeScope } from "../../lib/analysis-api.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { PanelCard, PanelCardTitle } from "../panel/primitives.js";
import { AppText, Skeleton } from "../ui/index.js";
import { AnalysisLink } from "./analysis-link.js";

export function AnalysisReviewHistory({ examId, onEntry }: { examId: string; onEntry: (id: string, scope: MistakeScope) => void }) {
  const { locale } = useLocale();
  const t = useTranslations("analysisReview");
  const tHistory = useTranslations("analysisHistory");
  const { palette, space, touchTargets } = useThemeTokens();
  const history = useInfiniteQuery({
    queryKey: ["notebook", "history", examId],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchNotebookReviewHistory(examId, pageParam),
    getNextPageParam: ({ page, pageSize, total }) => page * pageSize < total ? page + 1 : undefined,
  });
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "Europe/Istanbul" });

  return (
    <PanelCard style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space.sm }}>
        <PanelCardTitle>{t("recent_title")}</PanelCardTitle>
        <AppText variant="micro" tone="secondary">{t("recent_caption", { days: 30 })}</AppText>
      </View>
      {history.isPending ? <Skeleton height={48} /> : null}
      {history.isError ? (
        <>
          <AppText variant="caption" tone="secondary">{t("error")}</AppText>
          <AnalysisLink label={t("retry")} onPress={() => void history.refetch()} />
        </>
      ) : history.isSuccess && !items.length ? <AppText variant="caption" tone="secondary">{t("empty")}</AppText> : null}
      {items.map((item) => {
        const Icon = item.solved ? CheckCircleIcon : RestartIcon;
        const description = [
          date.format(new Date(item.reviewedAt)), t(item.solved ? "solved" : "missed"),
          item.early ? t("early") : null,
          item.nextReviewAt ? t("next_short", { date: date.format(new Date(item.nextReviewAt)) }) : null,
        ].filter(Boolean).join(" · ");
        return (
          <Pressable key={item.id} accessibilityRole="button" onPress={() => onEntry(item.entryId, { subjectRef: item.subjectRef ?? undefined, topicRef: item.topicRef ?? undefined })}
            style={[styles.row, { minHeight: touchTargets.comfortable, borderColor: palette.border, paddingVertical: space.sm, gap: space.sm }]}>
            <Icon size={22} color={item.solved ? palette.success : palette.secondary} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="caption" style={{ fontWeight: "800" }}>{[item.subjectName, item.topicName].filter(Boolean).join(" · ") || t("unlabelled")}</AppText>
              <AppText variant="micro" tone="secondary">{description}</AppText>
            </View>
            <AltArrowRightIcon size={16} color={palette.secondary} />
          </Pressable>
        );
      })}
      {history.hasNextPage && !history.isFetchingNextPage ? (
        <AnalysisLink label={tHistory("load_more")} onPress={() => void history.fetchNextPage()} />
      ) : null}
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth },
});
