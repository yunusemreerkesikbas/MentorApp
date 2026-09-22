"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form";
import {
  LEDGE,
  LEDGE_FILLED,
  PANEL_CARD,
  PANEL_GRID_CLASS,
  PANEL_MAIN_CLASS,
  PANEL_TEXT_LINK,
} from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { AnalysisHistorySkeleton, AnalysisTabSkeleton } from "./analysis-content-skeleton";
import { AnalysisHeader } from "./analysis-header";
import { AnalysisHistoryCard } from "./analysis-history-card";
import { AnalysisTabEntry } from "./analysis-tab-entry";
import {
  buildAnalysisTabHref,
  parseAnalysisTab,
  shouldNavigateAnalysisTab,
  type AnalysisTab,
  type AnalysisViewTab,
} from "./analysis-types";
import { FocusPathCard } from "./focus-path-card";
import { MistakesWhereCard } from "./mistakes-where-card";
import { MistakesWhyCard } from "./mistakes-why-card";
import { NetTrendCard } from "./net-trend-card";
import { NotebookFunnelCard } from "./notebook-funnel-card";
import { ReviewHistoryCard } from "./review-history-card";
import { SubjectsCard } from "./subjects-card";
import { useAnalysisData } from "./use-analysis-data";
import { useGhostNarration } from "./use-ghost-narration";
import { useMockExamEntry } from "./use-mock-exam-entry";

const tabTransition = {
  type: "tween" as const,
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1] as const,
};

/**
 * Deneme analizi in the panel's frame: the page's header, the two views (Gelişim · Yanlışlarım),
 * the form behind "Deneme ekle", and past exams in the rail. Orchestrates; the sections render.
 */
export function AnalysisShell() {
  const t = useTranslations("analysis");
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const data = useAnalysisData();
  const { refresh } = data;
  const examId = data.exam?.id ?? null;
  // Once per page: a save and the Gelişim hero share the one narration request per attempt.
  const narration = useGhostNarration(data.analysis, examId);
  const [tab, setActiveTab] = useState<AnalysisTab>(() =>
    parseAnalysisTab(searchParams.get("tab")),
  );
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  /** Where "Analize dön" leads: the view the form was opened from. */
  const returnTab = useRef<AnalysisViewTab>(tab === "mistakes" ? "mistakes" : "progress");
  const entryScrollRequested = useRef(false);

  const setTab = useCallback(
    (next: AnalysisTab) => {
      if (!shouldNavigateAnalysisTab(tab, next)) return;
      if (next === "entry" && tab !== "entry") returnTab.current = tab;
      setActiveTab(next);
      window.history.replaceState(
        window.history.state,
        "",
        buildAnalysisTabHref(window.location.pathname, window.location.search, next),
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

  const handleHistoryChanged = useCallback(() => {
    setHistoryRefreshKey((key) => key + 1);
    void refresh();
  }, [refresh]);

  const entry = useMockExamEntry({
    exam: data.exam,
    subjects: data.subjects,
    analysis: data.analysis,
    onSaved: async () => {
      await refresh();
      setHistoryRefreshKey((key) => key + 1);
    },
    onFirstInsight: () => {
      setTab("progress");
      requestAnimationFrame(() => {
        document.getElementById("analysis-tab-progress")?.focus();
      });
    },
  });

  if (data.state.status === "needs_exam_type") {
    return (
      <main className={PANEL_MAIN_CLASS} aria-label={t("title")}>
        <ExamTypeGate />
      </main>
    );
  }

  const loading = data.state.status === "loading";
  const loadError = data.state.status === "error" ? data.state.message : null;

  const header = (
    <AnalysisHeader
      tab={tab}
      examName={data.exam?.name ?? null}
      loading={loading}
      onTab={setTab}
      onAddExam={() => setTab("entry")}
      onBack={() => setTab(returnTab.current)}
    />
  );

  const view = loadError ? (
    <div className="flex flex-col items-start gap-1">
      <FormError message={loadError} />
      <button type="button" onClick={data.retry} className={PANEL_TEXT_LINK}>
        {t("load_retry")}
      </button>
    </div>
  ) : loading ? (
    <AnalysisTabSkeleton tab={tab} />
  ) : (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={tab}
        role={tab === "entry" ? "region" : "tabpanel"}
        id={`analysis-panel-${tab}`}
        aria-labelledby={tab === "entry" ? undefined : `analysis-tab-${tab}`}
        aria-label={tab === "entry" ? t("tabs.entry") : undefined}
        className="flex flex-col gap-5"
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
        transition={reduceMotion ? { duration: 0 } : tabTransition}
      >
        {tab === "entry" ? (
          <>
            <FormError message={entry.error} />
            <AnalysisTabEntry
              exam={data.exam}
              subjects={data.subjects}
              scores={entry.scores}
              submitting={entry.submitting}
              publisherName={entry.publisherName}
              takenAtDate={entry.takenAtDate}
              onPublisherChange={entry.setPublisherName}
              onTakenAtChange={entry.setTakenAtDate}
              onScoreChange={entry.updateScore}
              onSubmit={(event) => void entry.submit(event)}
              onCopyLast={(mock) => {
                entry.copyFrom(mock);
                openEntryForm();
              }}
              notebookHandoff={entry.notebookHandoff}
              onDismissNotebookHandoff={entry.dismissHandoff}
            />
          </>
        ) : null}
        {tab === "progress" && data.analysis && examId ? (
          <>
            <FocusPathCard
              analysis={data.analysis}
              examId={examId}
              narration={narration}
              onNewExam={() => setTab("entry")}
            />
            <NetTrendCard analysis={data.analysis} />
            <SubjectsCard analysis={data.analysis} />
          </>
        ) : null}
        {tab === "mistakes" && data.analysis && examId ? (
          <>
            <MistakesWhyCard analysis={data.analysis} examId={examId} />
            <MistakesWhereCard analysis={data.analysis} examId={examId} />
            <NotebookFunnelCard analysis={data.analysis} />
            <ReviewHistoryCard examId={examId} />
          </>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );

  const history = examId ? (
    <AnalysisHistoryCard
      examId={examId}
      refreshKey={historyRefreshKey}
      subjects={data.subjects}
      onChanged={handleHistoryChanged}
    />
  ) : loading ? (
    <AnalysisHistorySkeleton />
  ) : null;

  // CSS grid, not the panel's JS switch: narrow screens read "view, then history", which is already
  // DOM order, so nothing has to remount when a window or tablet crosses 1280px (a remount would
  // drop a half-typed form).
  return (
    <main className={PANEL_MAIN_CLASS} aria-label={t("title")}>
      <div className={PANEL_GRID_CLASS}>
        <div className="flex min-w-0 flex-col gap-5">
          {header}
          {view}
        </div>
        <aside className="flex min-w-0 flex-col gap-5">{history}</aside>
      </div>
    </main>
  );
}

function ExamTypeGate() {
  const t = useTranslations("analysis");

  return (
    <section className={PANEL_CARD}>
      <EmptyState
        title={t("needs_exam_chip")}
        description={t("needs_exam_desc")}
        puhuVariant="host"
        action={
          <Link href="/settings" className={`${LEDGE} ${LEDGE_FILLED} w-full`}>
            {t("needs_exam_cta")}
          </Link>
        }
      />
    </section>
  );
}
