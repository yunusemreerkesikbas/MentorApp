import { Pressable, View } from "react-native";
import type { AnalysisTab, AnalysisViewTab } from "@mentor/core";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Skeleton, SlidingTabs } from "../ui/index.js";

export function AnalysisHeader({ tab, examName, loading, onTab, onAddExam, onBack }: {
  tab: AnalysisTab;
  examName: string | null;
  loading: boolean;
  onTab: (tab: AnalysisViewTab) => void;
  onAddExam: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("analysis");
  const { palette, space, touchTargets } = useThemeTokens();
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.md }}>
        <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
          <AppText variant="title" accessibilityRole="header">{t("title")}</AppText>
          {examName ? <AppText variant="caption" tone="secondary" numberOfLines={1}>{examName}</AppText>
            : loading ? <Skeleton width={128} height={16} /> : null}
        </View>
        {tab !== "entry" ? <Button label={t("add_mock_cta")} variant="secondary" onPress={onAddExam}
          style={{ paddingHorizontal: space.md }} /> : null}
      </View>
      {tab === "entry" ? (
        <Pressable accessibilityRole="button" onPress={onBack}
          style={{ alignSelf: "flex-start", minHeight: touchTargets.min, justifyContent: "center" }}>
          <AppText variant="caption" style={{ color: palette.progress }}>{t("entry_back")}</AppText>
        </Pressable>
      ) : (
        <SlidingTabs value={tab} onChange={onTab} accessibilityLabel={t("tabs_label")}
          items={[{ id: "progress", label: t("tab_progress") }, { id: "mistakes", label: t("tab_mistakes") }]} />
      )}
    </View>
  );
}
