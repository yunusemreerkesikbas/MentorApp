import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parseAnalysisTab, type AnalysisTab } from "@mentor/core";
import { ExamType, type MockExamDto } from "@mentor/types";
import { AnalysisProgressView } from "../../../components/analysis/analysis-progress-view.js";
import { MistakeNotebookView } from "../../../components/analysis/mistake-notebook-view.js";
import { MockExamEntryView } from "../../../components/analysis/mock-exam-entry-view.js";
import {
  AppText,
  Chip,
  ScreenLoadingSkeleton,
  StateView,
} from "../../../components/ui/index.js";
import {
  fetchCoachingAnalysis,
  fetchDueNotebookEntries,
  fetchExamTaxonomy,
  fetchMockExamsList,
  fetchNotebookEntries,
} from "../../../lib/analysis-api.js";
import { useAuth } from "../../../providers/auth-provider.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

const TABS: { id: AnalysisTab; labelKey: "tab_progress" | "tab_mistakes" | "tab_entry" }[] = [
  { id: "progress", labelKey: "tab_progress" },
  { id: "mistakes", labelKey: "tab_mistakes" },
  { id: "entry", labelKey: "tab_entry" },
];

export default function AnalysisScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { user } = useAuth();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("analysis");
  const tCommon = useTranslations("common");

  const [activeTab, setActiveTab] = useState<AnalysisTab>(() =>
    parseAnalysisTab(params.tab),
  );

  const examType = user?.examType ?? ExamType.YKS;
  const examVariant = user?.examVariant ?? null;

  const taxonomyQuery = useQuery({
    queryKey: ["exam-taxonomy", examType, examVariant],
    queryFn: () => fetchExamTaxonomy(examType, examVariant),
  });

  const examId = taxonomyQuery.data?.exam.id;

  const analysisQuery = useQuery({
    queryKey: ["coaching", "analysis", examId],
    queryFn: () => fetchCoachingAnalysis(examId!),
    enabled: Boolean(examId),
  });

  const mockExamsQuery = useQuery({
    queryKey: ["mock-exams", examId],
    queryFn: () => fetchMockExamsList(examId, 10),
    enabled: Boolean(examId),
  });

  const dueEntriesQuery = useQuery({
    queryKey: ["notebook", "due"],
    queryFn: fetchDueNotebookEntries,
    enabled: Boolean(examId),
  });

  const recentEntriesQuery = useQuery({
    queryKey: ["notebook", "entries", examId],
    queryFn: () => fetchNotebookEntries(examId, 15),
    enabled: Boolean(examId),
  });

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["coaching", "analysis", examId],
      }),
      queryClient.invalidateQueries({ queryKey: ["mock-exams", examId] }),
      queryClient.invalidateQueries({ queryKey: ["notebook"] }),
      queryClient.invalidateQueries({ queryKey: ["coaching", "today"] }),
      queryClient.invalidateQueries({ queryKey: ["plan-tasks"] }),
    ]);
  };

  const handleOpenCoachForExam = (mockExam: MockExamDto) => {
    router.push({
      pathname: "/(app)/(tabs)/coach" as never,
      params: {
        contextMockExamId: mockExam.id,
        seed: `${mockExam.publisherName ?? mockExam.examName} (${mockExam.totalNet} net)`,
      },
    });
  };

  const isLoading =
    taxonomyQuery.isLoading || (Boolean(examId) && analysisQuery.isLoading);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: palette.bg }}
      refreshControl={
        <RefreshControl
          refreshing={analysisQuery.isRefetching}
          onRefresh={() => void refreshAll()}
          tintColor={palette.accent}
        />
      }
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingBottom: space.xl,
        paddingHorizontal: space.lg,
        gap: space.lg,
      }}
    >
      <View style={{ gap: space.xs }}>
        <AppText variant="title">{t("title")}</AppText>
        <AppText variant="body" tone="secondary">
          {t("subtitle")}
        </AppText>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabRow}>
        {TABS.map((item) => (
          <Chip
            key={item.id}
            label={t(item.labelKey)}
            selected={activeTab === item.id}
            onPress={() => setActiveTab(item.id)}
          />
        ))}
      </View>

      {isLoading ? (
        <ScreenLoadingSkeleton />
      ) : taxonomyQuery.isError || !taxonomyQuery.data ? (
        <StateView
          title={tCommon("error_title")}
          body={tCommon("error_body")}
          actionLabel={tCommon("retry")}
          onAction={() => void taxonomyQuery.refetch()}
          tone="error"
        />
      ) : activeTab === "entry" ? (
        <MockExamEntryView
          exam={taxonomyQuery.data.exam}
          subjects={taxonomyQuery.data.subjects}
          onSaved={() => {
            void refreshAll();
            setActiveTab("progress");
          }}
        />
      ) : activeTab === "mistakes" ? (
        <MistakeNotebookView
          examId={taxonomyQuery.data.exam.id}
          subjects={taxonomyQuery.data.subjects}
          analysis={analysisQuery.data ?? null}
          dueEntries={dueEntriesQuery.data ?? []}
          recentEntries={recentEntriesQuery.data ?? []}
          onRefresh={() => void refreshAll()}
        />
      ) : (
        <AnalysisProgressView
          examId={taxonomyQuery.data.exam.id}
          analysis={analysisQuery.data ?? null}
          mockExams={mockExamsQuery.data ?? []}
          onOpenEntryTab={() => setActiveTab("entry")}
          onOpenCoachForExam={handleOpenCoachForExam}
          onRefresh={() => void refreshAll()}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
