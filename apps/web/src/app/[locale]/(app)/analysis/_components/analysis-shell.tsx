"use client";
import { ClipboardList, PanelLeft } from "lucide-react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type {
  AuthUser,
  CoachingAnalysisDto,
  ExamCalendarDto,
  ExamSubjectDto,
  ExamSummaryDto,
  MockExamDto,
} from "@mentor/types";
import {
  ApiClientError,
  contentControllerCalendarByFamily,
  contentControllerSubjectsBySlug,
  http,
  usersControllerMe,
} from "@mentor/api-client";
import { Button, Card, SkeletonGroup } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form";
import {
  HistorySideDrawer,
  HistorySideRail,
} from "@/components/history-side-panel";
import { useMentorToast } from "@/lib/mentor-toast";
import { AnalysisSkeletonBlocks } from "./analysis-content-skeleton";
import { AnalysisHistoryList } from "./analysis-history-list";
import { AnalysisSegmentControl } from "./analysis-segment-control";
import { AnalysisSummaryBand } from "./analysis-summary-band";
import { AnalysisTabProgress } from "./analysis-tab-progress";
import { AnalysisTabEntry } from "./analysis-tab-entry";
import { AnalysisTabMistakes } from "./analysis-tab-mistakes";
import {
  buildAnalysisTabHref,
  emptyScores,
  parseAnalysisTab,
  scoresFromMockExam,
  shouldNavigateAnalysisTab,
  shouldRevealFirstInsight,
  type AnalysisTab,
  type SubjectScores,
} from "./analysis-types";

const tabTransition = {
  type: "tween" as const,
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1] as const,
};

const SHELL_MIN_H =
  "flex w-full min-h-[calc(100dvh-4rem-80px-env(safe-area-inset-bottom))] lg:min-h-[calc(100dvh-4rem)]";

const railIconBtn =
  "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_5%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none";

type ReadyData = {
  exam: ExamSummaryDto | null;
  subjects: ExamSubjectDto[];
  analysis: CoachingAnalysisDto | null;
};


type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "needs_exam_type" }
  | { status: "ready"; data: ReadyData };

function getAnalysisUrl(examId: string): string {
  const qs = new URLSearchParams({ examId });
  return `/v1/coaching/analysis?${qs.toString()}`;
}

function getMockExamsUrl(): string {
  return "/v1/mock-exams";
}

/**
 * Deneme analizi — 3 mod (Gir / Gelişim / Yanlışlarım), sunucu hesaplı net, kişisel trend.
 */
export function AnalysisShell() {
  const t = useTranslations("analysis");
  const toast = useMentorToast();
  const searchParams = useSearchParams();
  const [tab, setActiveTab] = useState<AnalysisTab>(() =>
    parseAnalysisTab(searchParams.get("tab")),
  );
  const reduceMotion = useReducedMotion();

  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [scores, setScores] = useState<Record<string, SubjectScores>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  /**
   * Set right after a mock exam is saved, when the wrong count is still on screen and still means
   * something. The notebook is where those numbers become cards the student actually revisits, and
   * until now nothing connected the two — `mockExamId` has been on the notebook entry since the
   * table was created with no flow that ever filled it.
   */
  const [notebookHandoff, setNotebookHandoff] = useState<{
    mockExamId: string;
    wrongTotal: number;
  } | null>(null);
  const [publisherName, setPublisherName] = useState("");
  const [takenAtDate, setTakenAtDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const entryScrollRequested = useRef(false);
  const tHistory = useTranslations("analysis.history");

  const setTab = useCallback(
    (next: AnalysisTab) => {
      if (!shouldNavigateAnalysisTab(tab, next)) return;
      setActiveTab(next);
      window.history.replaceState(
        window.history.state,
        "",
        buildAnalysisTabHref(
          window.location.pathname,
          window.location.search,
          next,
        ),
      );
    },
    [tab],
  );

  const activateEntryForm = useCallback(() => {
    const form = document.getElementById("analysis-form");
    form?.scrollIntoView({ block: "start" });
    form
      ?.querySelector<HTMLInputElement>('input[type="number"]')
      ?.focus({ preventScroll: true });
  }, []);

  const openEntryForm = useCallback(() => {
    if (tab === "entry") {
      activateEntryForm();
      return;
    }
    entryScrollRequested.current = true;
    setTab("entry");
  }, [activateEntryForm, setTab, tab]);

  useEffect(() => {
    if (tab !== "entry" || !entryScrollRequested.current) return;
    entryScrollRequested.current = false;
    requestAnimationFrame(activateEntryForm);
  }, [activateEntryForm, tab]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const me = (await usersControllerMe()) as unknown as AuthUser;
        if (!active) return;

        if (!me.examType) {
          setLoadState({ status: "needs_exam_type" });
          return;
        }

        const calendarRes = await contentControllerCalendarByFamily(
          me.examType,
        );
        if (!active) return;

        const calendar = calendarRes as unknown as ExamCalendarDto | null;
        const current = calendar?.exam ?? null;
        const [analysis, subjectRows] = current
          ? await Promise.all([
              http<CoachingAnalysisDto>(getAnalysisUrl(current.id)),
              contentControllerSubjectsBySlug(
                current.slug,
              ) as unknown as Promise<ExamSubjectDto[]>,
            ])
          : [null, []];
        if (!active) return;

        setScores(emptyScores(subjectRows));
        setLoadState({
          status: "ready",
          data: {
            exam: current,
            subjects: subjectRows,
            analysis,
          },
        });
      } catch (loadError) {
        if (!active) return;
        setLoadState({
          status: "error",
          message:
            loadError instanceof ApiClientError
              ? loadError.message
              : loadError instanceof Error
                ? loadError.message
                : String(loadError),
        });
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  const readyData = loadState.status === "ready" ? loadState.data : null;
  const exam = readyData?.exam ?? null;
  const subjects = useMemo(
    () => readyData?.subjects ?? [],
    [readyData?.subjects],
  );
  const analysis = readyData?.analysis ?? null;

  const refreshAnalysis = useCallback(async () => {
    if (!exam || loadState.status !== "ready") return;
    const analysisRes = await http<CoachingAnalysisDto>(
      getAnalysisUrl(exam.id),
    );
    setLoadState((current) =>
      current.status === "ready" && current.data.exam?.id === exam.id
        ? {
            status: "ready",
            data: { ...current.data, analysis: analysisRes },
          }
        : current,
    );
  }, [exam, loadState.status]);

  const handleHistoryChanged = useCallback(() => {
    setHistoryRefreshKey((key) => key + 1);
    void refreshAnalysis();
  }, [refreshAnalysis]);

  function updateScore(
    slug: string,
    field: keyof SubjectScores,
    value: string,
  ) {
    setScores((prev) => ({
      ...prev,
      [slug]: { ...prev[slug]!, [field]: value },
    }));
  }

  const handleCopyLast = useCallback(
    (mock: MockExamDto) => {
      setScores(scoresFromMockExam(subjects, mock.subjects));
      setPublisherName(mock.publisherName ?? "");
      setTakenAtDate(mock.takenAt.slice(0, 10));
      openEntryForm();
    },
    [openEntryForm, subjects],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!exam || submitting || loadState.status !== "ready") return;
    const revealFirstInsight = shouldRevealFirstInsight(
      analysis?.trend.length ?? 0,
    );
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        examId: exam.id,
        ...(publisherName.trim()
          ? { publisherName: publisherName.trim() }
          : {}),
        ...(takenAtDate
          ? { takenAt: new Date(`${takenAtDate}T12:00:00`).toISOString() }
          : {}),
        subjects: subjects.map((subject) => ({
          subjectRef: subject.slug,
          correct: Number(scores[subject.slug]?.correct || 0),
          wrong: Number(scores[subject.slug]?.wrong || 0),
          blank: Number(scores[subject.slug]?.blank || 0),
        })),
      };
      const result = await http<MockExamDto>(getMockExamsUrl(), {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success({
        title: t("saved_toast_title"),
        message: t("saved_toast_message", { net: result.totalNet }),
      });
      // Hand the mistakes over before the form is cleared: this is the only moment the student
      // knows how many they missed and in which subject, and the notebook is where that stops
      // being a number and starts being something they can review.
      const wrongTotal = payload.subjects.reduce(
        (sum, subject) => sum + subject.wrong,
        0,
      );
      setNotebookHandoff(
        wrongTotal > 0 ? { mockExamId: result.id, wrongTotal } : null,
      );
      await refreshAnalysis();
      setHistoryRefreshKey((key) => key + 1);
      setScores(emptyScores(subjects));
      setPublisherName("");
      setTakenAtDate(new Date().toISOString().slice(0, 10));
      if (revealFirstInsight) {
        setTab("progress");
        requestAnimationFrame(() => {
          document.getElementById("analysis-tab-progress")?.focus();
        });
      }
    } catch (submitError) {
      setError(
        submitError instanceof ApiClientError
          ? submitError.message
          : submitError instanceof Error
            ? submitError.message
            : String(submitError),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadState.status === "error") {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-10">
        <Card className="flex flex-col items-start gap-4">
          <FormError message={loadState.message} />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setLoadState({ status: "loading" });
              setLoadAttempt((attempt) => attempt + 1);
            }}
          >
            {t("load_retry")}
          </Button>
        </Card>
      </main>
    );
  }

  if (loadState.status === "needs_exam_type") {
    return (
      <main
        className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-10"
        aria-label={t("title")}
      >
        <FormError message={error} />
        <ExamTypeGate />
      </main>
    );
  }

  const loading = loadState.status === "loading";
  const historyListProps =
    exam?.id != null
      ? {
          examId: exam.id,
          refreshKey: historyRefreshKey,
          subjects,
          onChanged: handleHistoryChanged,
        }
      : null;

  const readyBody = loading ? (
    <div className="min-h-[36rem]" aria-hidden />
  ) : (
    <div className={SHELL_MIN_H} aria-label={t("title")}>
      <HistorySideRail
        title={tHistory("title")}
        railOpen={railOpen}
        onRailOpenChange={setRailOpen}
        expandLabel={tHistory("open")}
        collapseLabel={tHistory("collapse")}
        testId="analysis-history-rail"
        collapsedActions={
          <button
            type="button"
            onClick={() => setRailOpen(true)}
            className={railIconBtn}
            aria-label={tHistory("title")}
            data-testid="analysis-history-rail-list"
          >
            <ClipboardList
              className="size-5"
              style={{ color: "var(--color-main)" }}
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
        }
      >
        {historyListProps ? (
          <AnalysisHistoryList {...historyListProps} />
        ) : null}
      </HistorySideRail>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 px-5 pt-4 pb-1 lg:hidden">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-surface)_90%,transparent)] shadow-[var(--shadow-card)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
            aria-label={tHistory("open")}
            data-testid="analysis-history-open"
          >
            <PanelLeft
              className="size-5"
              style={{ color: "var(--color-main)" }}
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
        </div>

        <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-4 lg:px-8 lg:py-8">
          <FormError message={error} />

          <div className="flex flex-col gap-6">
            <AnalysisSummaryBand analysis={analysis} />

            <AnalysisSegmentControl value={tab} onChange={setTab} />

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                role="tabpanel"
                id={`analysis-panel-${tab}`}
                aria-labelledby={`analysis-tab-${tab}`}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={reduceMotion ? { duration: 0 } : tabTransition}
              >
                {tab === "entry" ? (
                  <AnalysisTabEntry
                    exam={exam}
                    subjects={subjects}
                    scores={scores}
                    submitting={submitting}
                    publisherName={publisherName}
                    takenAtDate={takenAtDate}
                    onPublisherChange={setPublisherName}
                    onTakenAtChange={setTakenAtDate}
                    onScoreChange={updateScore}
                    onSubmit={(event) => void submit(event)}
                    onCopyLast={handleCopyLast}
                    notebookHandoff={notebookHandoff}
                    onDismissNotebookHandoff={() => setNotebookHandoff(null)}
                  />
                ) : null}

                {tab === "progress" ? (
                  <AnalysisTabProgress analysis={analysis} />
                ) : null}

                {tab === "mistakes" ? (
                  <AnalysisTabMistakes
                    analysis={analysis}
                  />
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <HistorySideDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        title={tHistory("title")}
        testId="analysis-history-drawer"
      >
        {historyListProps ? (
          <AnalysisHistoryList {...historyListProps} />
        ) : null}
      </HistorySideDrawer>
    </div>
  );

  return (
    <main className="w-full" aria-label={t("title")}>
      <SkeletonGroup label={t("loading")} loading={loading} revealed={readyBody}>
        <AnalysisSkeletonBlocks />
      </SkeletonGroup>
    </main>
  );
}

function ExamTypeGate() {
  const t = useTranslations("analysis");

  return (
    <Card>
      <EmptyState
        title={t("needs_exam_chip")}
        description={t("needs_exam_desc")}
        puhuVariant="host"
        action={
          <Link
            href="/settings"
            className="flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-card)] px-6 py-3 text-base font-bold text-[var(--color-btn-label)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{
              backgroundColor: "var(--color-btn)",
              boxShadow: "var(--shadow-card)",
              fontFamily: "var(--font-body)",
            }}
          >
            {t("needs_exam_cta")}
          </Link>
        }
      />
    </Card>
  );
}
