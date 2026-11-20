import { useCallback, useRef, useState } from "react";
import { BackHandler, RefreshControl, ScrollView, View, type ScrollViewInstance } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { needsFocusDueCount, parseAnalysisTab, type AnalysisTab, type AnalysisViewTab } from "@mentor/core";
import { ExamType, type MockExamDto } from "@mentor/types";
import { AnalysisFocusCard } from "../../../components/analysis/analysis-focus-card.js";
import { AnalysisHeader } from "../../../components/analysis/analysis-header.js";
import { AnalysisLink } from "../../../components/analysis/analysis-link.js";
import { AnalysisMistakesView } from "../../../components/analysis/analysis-mistakes-view.js";
import { AnalysisNetCard } from "../../../components/analysis/analysis-net-card.js";
import { AnalysisHistoryCard, AnalysisSubjectsCard } from "../../../components/analysis/analysis-progress-view.js";
import { AnalysisSavedCard } from "../../../components/analysis/analysis-saved-card.js";
import { MistakeNotebookView, type NotebookSheetState } from "../../../components/analysis/mistake-notebook-view.js";
import { MockExamEntryView } from "../../../components/analysis/mock-exam-entry-view.js";
import { FormSheet, PanelCard, PanelCardTitle } from "../../../components/panel/primitives.js";
import { AppText, ScreenLoadingSkeleton, StateView } from "../../../components/ui/index.js";
import {
  fetchCoachingAnalysis, fetchExamTaxonomy, fetchMockExamsList, fetchNotebookReviewSummary,
  type MistakeScope,
} from "../../../lib/analysis-api.js";
import { useAuth } from "../../../providers/auth-provider.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { tabBarClearance } from "../../../lib/layout.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

export default function AnalysisScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { user } = useAuth();
  const { locale } = useLocale();
  const { palette, space } = useThemeTokens();
  const tReport = useTranslations("recapReport");
  const tRecap = useTranslations("recap");
  const tHistory = useTranslations("analysisHistory");
  const tCommon = useTranslations("common");

  const [activeTab, setActiveTab] = useState<AnalysisTab>(() => parseAnalysisTab(params.tab));
  const [saved, setSaved] = useState<MockExamDto | null>(null);
  const [editing, setEditing] = useState<MockExamDto | null>(null);
  const [notebook, setNotebook] = useState<NotebookSheetState | null>(null);
  const returnTab = useRef<AnalysisViewTab>(activeTab === "mistakes" ? "mistakes" : "progress");
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: false });

  const changeTab = (next: AnalysisTab) => {
    if (next === "entry" && activeTab !== "entry") returnTab.current = activeTab;
    setActiveTab(next);
    setSaved(null);
    scrollToTop();
  };

  useFocusEffect(useCallback(() => {
    if (activeTab !== "entry") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setActiveTab(returnTab.current);
      setSaved(null);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      return true;
    });
    return () => subscription.remove();
  }, [activeTab]));

  const examType = user?.examType ?? ExamType.YKS;
  const examVariant = user?.examVariant ?? null;
  const taxonomyQuery = useQuery({
    queryKey: ["exam-taxonomy", examType, examVariant, locale],
    queryFn: () => fetchExamTaxonomy(examType, examVariant),
  });
  const taxonomy = taxonomyQuery.data;
  const examId = taxonomy?.exam.id;

  const analysisQuery = useQuery({
    queryKey: ["coaching", "analysis", examId, locale],
    queryFn: () => fetchCoachingAnalysis(examId!),
    enabled: Boolean(examId),
  });
  const analysis = analysisQuery.data;
  const focus = analysis?.improvementCycle?.focus;
  const focusDue = useQuery({
    queryKey: ["notebook", "summary", examId, focus?.subjectRef, focus?.topicRef],
    queryFn: () => fetchNotebookReviewSummary(examId!, { subjectRef: focus?.subjectRef, topicRef: focus?.topicRef }),
    enabled: activeTab === "progress" && Boolean(examId && analysis && needsFocusDueCount(analysis)),
  });

  const history = useInfiniteQuery({
    queryKey: ["mock-exams", examId, locale],
    queryFn: ({ pageParam }) => fetchMockExamsList(examId!, pageParam),
    initialPageParam: 1,
    getNextPageParam: ({ page, pageSize, total }) => page * pageSize < total ? page + 1 : undefined,
    enabled: Boolean(examId),
  });
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];
  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["coaching", "analysis", examId] }),
      queryClient.invalidateQueries({ queryKey: ["mock-exams", examId] }),
      queryClient.invalidateQueries({ queryKey: ["notebook"] }),
      queryClient.invalidateQueries({ queryKey: ["coaching", "today"] }),
      queryClient.invalidateQueries({ queryKey: ["plan-tasks"] }),
    ]);
  };

  const openCoach = (mockExamId: string, seed: string) => {
    router.push({
      pathname: "/(app)/(tabs)/coach" as never,
      params: { contextMockExamId: mockExamId, seed },
    });
  };
  const openNotebook = (scope: MistakeScope, reviewing: boolean) => setNotebook({ scope, reviewing });
  const openExamMistakes = (mockExamId: string) => openNotebook({ mockExamId }, false);
  const isLoading = taxonomyQuery.isPending || (Boolean(examId) && analysisQuery.isPending && activeTab !== "entry");

  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: palette.bg }}
      refreshControl={
        <RefreshControl
          refreshing={taxonomyQuery.isRefetching || analysisQuery.isRefetching}
          onRefresh={() => void Promise.all([refreshAll(), taxonomyQuery.refetch()])}
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
      <AnalysisHeader tab={activeTab} examName={taxonomy?.exam.name ?? null}
        loading={taxonomyQuery.isPending} onTab={changeTab} onAddExam={() => changeTab("entry")}
        onBack={() => changeTab(returnTab.current)} />

      {examId ? (
        <PanelCard style={{ gap: space.sm }}>
          <PanelCardTitle>{tReport("entry_title")}</PanelCardTitle>
          <AppText tone="secondary">{tReport("entry_detail")}</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space.md }}>
            <AnalysisLink label={tReport("entry_cta")} onPress={() => router.push({
              pathname: "/(app)/weekly-recap" as never,
              params: { examId, view: "analysis" },
            })} />
            <AnalysisLink label={tRecap("archive_title")} onPress={() => router.push("/(app)/weekly-recap/archive" as never)} />
          </View>
        </PanelCard>
      ) : null}

      {isLoading ? <ScreenLoadingSkeleton /> : !taxonomy || (!analysis && activeTab !== "entry") ? (
        <StateView
          title={tCommon("error_title")}
          body={tCommon("error_body")}
          actionLabel={tCommon("retry")}
          onAction={() => void (taxonomy ? analysisQuery.refetch() : taxonomyQuery.refetch())}
          tone="error"
        />
      ) : activeTab === "entry" ? (
        saved?.examId === taxonomy.exam.id ? (
          <AnalysisSavedCard item={saved} analysis={analysis}
            onProgress={() => changeTab("progress")}
            onMistakes={() => openExamMistakes(saved.id)}
            onNew={() => changeTab("entry")} />
        ) : (
          <MockExamEntryView
            key={`entry-${taxonomy.exam.id}`}
            exam={taxonomy.exam}
            subjects={taxonomy.subjects}
            prior={items[0]}
            onSaved={(item) => {
              setSaved(item);
              scrollToTop();
              void refreshAll();
            }}
          />
        )
      ) : analysis && activeTab === "mistakes" ? (
        <AnalysisMistakesView examId={taxonomy.exam.id} analysis={analysis} onOpen={openNotebook}
          onEntry={(entryId) => setNotebook({ scope: {}, reviewing: false, entryId })} />
      ) : analysis ? (
        <>
          <AnalysisFocusCard key={`focus-${taxonomy.exam.id}`} examId={taxonomy.exam.id} analysis={analysis}
            dueCount={focusDue.data?.dueCount ?? null} onEntry={() => changeTab("entry")}
            onReview={openNotebook} onCoach={openCoach} onRefresh={refreshAll} />
          <AnalysisNetCard analysis={analysis} />
          <AnalysisSubjectsCard analysis={analysis} />
        </>
      ) : null}
      {examId ? (
        <AnalysisHistoryCard key={`history-${examId}`} items={items} loading={history.isPending} error={history.isError}
          hasMore={history.hasNextPage && !history.isFetchingNextPage} onMore={() => void history.fetchNextPage()}
          onRefresh={refreshAll} onCoach={openCoach} onMistakes={openExamMistakes} onEdit={setEditing} />
      ) : null}
      {notebook && taxonomy ? (
        <MistakeNotebookView examId={taxonomy.exam.id} subjects={taxonomy.subjects}
          initial={notebook} onClose={() => setNotebook(null)} onRefresh={refreshAll} />
      ) : null}
      {editing && taxonomy ? (
        <FormSheet visible title={tHistory("edit_title")} closeLabel={tCommon("close")} onClose={() => setEditing(null)}>
          <MockExamEntryView key={editing.id} exam={taxonomy.exam} subjects={taxonomy.subjects} edit={editing}
            onCancel={() => setEditing(null)} onSaved={() => {
              setEditing(null);
              void refreshAll();
            }} />
        </FormSheet>
      ) : null}
    </ScrollView>
  );
}
