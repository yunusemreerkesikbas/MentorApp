import { useCallback, useRef, useState } from "react";
import { BackHandler, RefreshControl, ScrollView, type ScrollViewInstance } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parseAnalysisTab, type AnalysisTab, type AnalysisViewTab } from "@mentor/core";
import { ExamType, type MockExamDto } from "@mentor/types";
import { AnalysisProgressView } from "../../../components/analysis/analysis-progress-view.js";
import { AnalysisHeader } from "../../../components/analysis/analysis-header.js";
import { MistakeNotebookView } from "../../../components/analysis/mistake-notebook-view.js";
import { MockExamEntryView } from "../../../components/analysis/mock-exam-entry-view.js";
import { PanelCard, PanelCardTitle } from "../../../components/panel/primitives.js";
import {
  AppText,
  Button,
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
import { fetchTodayPanel } from "../../../lib/coaching-api.js";
import { useAuth } from "../../../providers/auth-provider.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { tabBarClearance } from "../../../lib/layout.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

export default function AnalysisScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { user } = useAuth();
  const { palette, space } = useThemeTokens();
  const tReport = useTranslations("recapReport");
  const tRecap = useTranslations("recap");
  const tCommon = useTranslations("common");

  const [activeTab, setActiveTab] = useState<AnalysisTab>(() =>
    parseAnalysisTab(params.tab),
  );
  const returnTab = useRef<AnalysisViewTab>(activeTab === "mistakes" ? "mistakes" : "progress");
  const scrollRef = useRef<ScrollViewInstance>(null);
  const changeTab = (next: AnalysisTab) => {
    if (next === activeTab) return;
    if (next === "entry" && activeTab !== "entry") returnTab.current = activeTab;
    setActiveTab(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  useFocusEffect(useCallback(() => {
    if (activeTab !== "entry") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setActiveTab(returnTab.current);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      return true;
    });
    return () => subscription.remove();
  }, [activeTab]));

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

  const todayQuery = useQuery({
    queryKey: ["coaching", "today"],
    queryFn: fetchTodayPanel,
    enabled: activeTab === "progress",
  });
  const recapPeriod = todayQuery.data?.weeklyRecapPeriod;

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
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
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
        paddingTop: space.lg,
        paddingBottom: tabBarClearance(insets.bottom),
        paddingHorizontal: space.lg,
        gap: space.lg,
      }}
    >
      <AnalysisHeader tab={activeTab} examName={taxonomyQuery.data?.exam.name ?? null}
        loading={taxonomyQuery.isLoading} onTab={changeTab} onAddExam={() => changeTab("entry")}
        onBack={() => changeTab(returnTab.current)} />

      {activeTab === "progress" && recapPeriod?.status === "READY" ? (
        <PanelCard style={{ gap: space.sm }}>
          <PanelCardTitle>{tReport("entry_title")}</PanelCardTitle>
          <AppText tone="secondary">{tReport("entry_detail")}</AppText>
          <Button label={tReport("entry_cta")} onPress={() => router.push({
            pathname: "/(app)/weekly-recap" as never,
            params: { examId: recapPeriod.examId, weekStart: recapPeriod.startDate, view: "analysis" },
          })} />
        </PanelCard>
      ) : null}

      {activeTab === "progress" ? (
        <Button
          variant="secondary"
          label={tRecap("archive_title")}
          onPress={() => router.push("/(app)/weekly-recap/archive" as never)}
        />
      ) : null}

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
            changeTab("progress");
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
          onOpenEntryTab={() => changeTab("entry")}
          onOpenCoachForExam={handleOpenCoachForExam}
          onRefresh={() => void refreshAll()}
        />
      )}
    </ScrollView>
  );
}
