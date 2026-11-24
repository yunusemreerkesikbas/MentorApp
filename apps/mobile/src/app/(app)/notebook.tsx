import { useState } from "react";
import { Pressable } from "react-native";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExamType, NOTEBOOK_ENTRY_STATUSES, NOTEBOOK_ERROR_TYPES } from "@mentor/types";
import { listNotebookEntriesQuerySchema, NOTEBOOK_MAX_PAGES } from "@mentor/validation";
import { MistakeNotebookView, type NotebookSheetState } from "../../components/analysis/mistake-notebook-view.js";
import { NotebookFrame, NotebookError } from "../../components/notebooks/notebook-frame.js";
import { NotebookPageEditor } from "../../components/notebooks/notebook-page-editor.js";
import { AppText, Button, Skeleton } from "../../components/ui/index.js";
import { fetchExamTaxonomy } from "../../lib/analysis-api.js";
import { getBook, getContents } from "../../lib/notebook-api.js";
import { nextPageIndex, readPageParam } from "../../lib/notebooks-view.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";

type Params = { notebookId?: string; page?: string; entry?: string; entryId?: string; review?: string; panel?: string;
  revisit?: string; days?: string; from?: string;
  examId?: string; mockExamId?: string; subjectRef?: string; topicRef?: string; errorType?: string; status?: string };
export default function NotebookRoute() {
  const params = useLocalSearchParams<Params>();
  return <OpenBook key={JSON.stringify(params)} params={params} />;
}
function OpenBook({ params }: { params: Params }) {
  const router = useRouter();
  const client = useQueryClient();
  const { user } = useAuth();
  const { locale } = useLocale();
  const t = useTranslations("notebooks");
  const { space, palette, touchTargets, radii } = useThemeTokens();
  const [page, setPage] = useState(readPageParam(params.page));
  const reviewDays = listNotebookEntriesQuerySchema.shape.days.safeParse(params.days);
  const scope = { subjectRef: params.subjectRef, topicRef: params.topicRef, mockExamId: params.mockExamId,
    errorType: NOTEBOOK_ERROR_TYPES.find(type => type === params.errorType), status: NOTEBOOK_ENTRY_STATUSES.find(status => status === params.status), revisit: params.revisit === "true" ? "true" as const : undefined,
    days: reviewDays.success && reviewDays.data !== undefined ? String(reviewDays.data) : undefined };
  const [sheet, setSheet] = useState<NotebookSheetState | null>(() => params.entry || params.entryId || params.review || params.panel === "index" ?
    { scope, reviewing: params.review === "due" || params.review === "focus", focusReview: params.review === "focus", entryId: params.entryId ?? params.entry } : null);
  const id = params.notebookId;
  const book = useQuery({ queryKey: ["notebook", "book", id], queryFn: () => getBook(id) });
  const contents = useQuery({ queryKey: ["notebook", "contents", id], queryFn: () => getContents(id) });
  const examType = user?.examType ?? ExamType.YKS;
  const variant = user?.examVariant ?? null;
  const taxonomy = useQuery({ queryKey: ["exam-taxonomy", examType, variant, locale], queryFn: () => fetchExamTaxonomy(examType, variant), enabled: !!sheet });
  const back = () => router.canGoBack() ? router.back() : router.replace("/(app)/notebooks" as never);
  if (book.data && page !== null) return <NotebookPageEditor key={page} book={book.data} page={page} close={() => setPage(null)} />;
  const pages = contents.data?.pages ?? [];
  const next = nextPageIndex(pages);
  const refresh = async () => { await Promise.all([
    client.invalidateQueries({ queryKey: ["notebook"] }), client.invalidateQueries({ queryKey: ["coaching", "analysis"] }),
    client.invalidateQueries({ queryKey: ["coaching", "today"] }),
  ]); };
  return <NotebookFrame title={book.data?.title ?? t("mistakes")} onBack={back}>
    {book.isError || contents.isError ? <NotebookError retry={() => { void book.refetch(); void contents.refetch(); }} /> :
      book.isPending || contents.isPending ? <Skeleton height={120} /> : <>
        <AppText variant="sectionHeading">{t("contents")}</AppText>
        {!pages.length && <AppText tone="secondary">{t("empty")}</AppText>}
        {pages.map(p => <Pressable key={p.pageIndex} accessibilityRole="button" onPress={() => setPage(p.pageIndex)}
          style={{ minHeight: touchTargets.comfortable, justifyContent: "center", padding: space.md, gap: space.xs,
            backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radii.inner }}>
          <AppText variant="cardTitle">{t("page", { n: p.pageIndex + 1 })}</AppText>
          {(p.noteTitle || p.topicName || p.subjectName) && <AppText tone="secondary">{p.noteTitle ?? p.topicName ?? p.subjectName}</AppText>}
        </Pressable>)}
        <Button label={t("add")} disabled={next >= (book.data.limits?.maxPages ?? NOTEBOOK_MAX_PAGES)} onPress={() => setPage(next)} />
        {book.data.kind === "MISTAKE" && <>
          <Button variant="secondary" label={t("index")} onPress={() => setSheet({ reviewing: false, scope })} />
          <Button variant="secondary" label={t("review")} onPress={() => setSheet({ reviewing: true, scope })} />
        </>}
      </>}
    {sheet && book.data?.kind === "MISTAKE" && (taxonomy.data || params.examId || sheet.entryId || sheet.reviewing) ?
      <MistakeNotebookView examId={params.examId} addExamId={params.examId ?? taxonomy.data?.exam.id} subjects={params.examId && params.examId !== taxonomy.data?.exam.id ? [] : taxonomy.data?.subjects ?? []}
        initial={sheet} onClose={() => params.review === "focus" ? back() : setSheet(null)} onRefresh={refresh} /> : null}
    {sheet && taxonomy.isError && !params.examId && !sheet.reviewing && !sheet.entryId && <NotebookError retry={() => void taxonomy.refetch()} />}
  </NotebookFrame>;
}
