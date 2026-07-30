"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ClipboardList from "lucide-react/dist/esm/icons/clipboard-list.mjs";
import PanelLeft from "lucide-react/dist/esm/icons/panel-left.mjs";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type {
  AuthUser,
  CoachingAnalysisDto,
  ExamCalendarDto,
  ExamSubjectDto,
  ExamSummaryDto,
  MockExamDto,
  PhotoAccessDto,
  WeeklyReviewDto,
} from "@mentor/types";
import {
  ApiClientError,
  contentControllerCalendarByFamily,
  contentControllerSubjectsBySlug,
  http,
  usersControllerMe,
} from "@mentor/api-client";
import { Button, Card } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import {
  HistorySideDrawer,
  HistorySideRail,
} from "@/components/history-side-panel";
import { useMentorToast } from "@/lib/mentor-toast";
import { fetchPhotoAccess } from "@/lib/mock-exams";
import { AnalysisContentSkeleton } from "./analysis-content-skeleton";
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

const railIconBtn =
  "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] transition-colors hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none";

type ReadyData = {
  exam: ExamSummaryDto | null;
  subjects: ExamSubjectDto[];
  analysis: CoachingAnalysisDto | null;
};

type ExamAsyncState<T> =
  | { status: "idle"; examId: string | null }
  | { status: "loading"; examId: string }
  | { status: "ready"; examId: string; data: T }
  | { status: "error"; examId: string; message: string };

type DevelopmentExtras = WeeklyReviewDto;

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "needs_exam_type" }
  | { status: "ready"; data: ReadyData };

function getAnalysisUrl(examId: string): string {
  const qs = new URLSearchParams({ examId });
  return `/v1/coaching/analysis?${qs.toString()}`;
}

function getWeeklyReviewUrl(examId: string): string {
  return `/v1/coaching/weekly-review?examId=${encodeURIComponent(examId)}`;
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

  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [scores, setScores] = useState<Record<string, SubjectScores>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [publisherName, setPublisherName] = useState("");
  const [takenAtDate, setTakenAtDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [developmentExtras, setDevelopmentExtras] = useState<
    ExamAsyncState<DevelopmentExtras>
  >({ status: "idle", examId: null });
  const [photoAccessState, setPhotoAccessState] = useState<
    ExamAsyncState<PhotoAccessDto>
  >({ status: "idle", examId: null });
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
        setDevelopmentExtras({ status: "idle", examId: current?.id ?? null });
        setPhotoAccessState({ status: "idle", examId: current?.id ?? null });
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
  const activeMockExamId = analysis?.trend[0]?.id ?? null;

  const loadDevelopmentExtras = useCallback(
    async (examId: string) => {
      setDevelopmentExtras({ status: "loading", examId });
      try {
        const weeklyReview = await http<WeeklyReviewDto>(
          getWeeklyReviewUrl(examId),
        );
        setDevelopmentExtras((current) =>
          current.status === "loading" && current.examId === examId
            ? { status: "ready", examId, data: weeklyReview }
            : current,
        );
      } catch (loadError) {
        setDevelopmentExtras((current) =>
          current.status === "loading" && current.examId === examId
            ? {
                status: "error",
                examId,
                message:
                  loadError instanceof Error
                    ? loadError.message
                    : t("weekly.load_error"),
              }
            : current,
        );
      }
    },
    [t],
  );

  const loadPhotoAccess = useCallback(
    async (examId: string) => {
      setPhotoAccessState({ status: "loading", examId });
      try {
        const access = await fetchPhotoAccess();
        setPhotoAccessState((current) =>
          current.status === "loading" && current.examId === examId
            ? { status: "ready", examId, data: access }
            : current,
        );
      } catch (loadError) {
        setPhotoAccessState((current) =>
          current.status === "loading" && current.examId === examId
            ? {
                status: "error",
                examId,
                message:
                  loadError instanceof Error
                    ? loadError.message
                    : t("photo_access_error"),
              }
            : current,
        );
      }
    },
    [t],
  );

  useEffect(() => {
    if (!exam || tab !== "progress") return;
    if (
      developmentExtras.examId === exam.id &&
      developmentExtras.status !== "idle"
    ) {
      return;
    }
    void loadDevelopmentExtras(exam.id);
  }, [developmentExtras, exam, loadDevelopmentExtras, tab]);

  useEffect(() => {
    if (!exam || tab !== "mistakes") return;
    if (
      photoAccessState.examId === exam.id &&
      photoAccessState.status !== "idle"
    ) {
      return;
    }
    void loadPhotoAccess(exam.id);
  }, [exam, loadPhotoAccess, photoAccessState, tab]);

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

  const invalidateExtraData = useCallback(() => {
    setDevelopmentExtras({ status: "idle", examId: exam?.id ?? null });
    setPhotoAccessState({ status: "idle", examId: exam?.id ?? null });
  }, [exam?.id]);

  const handleHistoryChanged = useCallback(() => {
    setHistoryRefreshKey((key) => key + 1);
    invalidateExtraData();
    void refreshAnalysis();
  }, [invalidateExtraData, refreshAnalysis]);

  const handlePhotoCategorized = useCallback(() => {
    invalidateExtraData();
    void refreshAnalysis();
  }, [invalidateExtraData, refreshAnalysis]);

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
      invalidateExtraData();
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

  if (loadState.status === "loading") {
    return <AnalysisContentSkeleton />;
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

  const historyListProps =
    exam?.id != null
      ? {
          examId: exam.id,
          refreshKey: historyRefreshKey,
          subjects,
          onChanged: handleHistoryChanged,
        }
      : null;

  return (
    <main
      className="flex w-full min-h-[calc(100dvh-4rem-80px-env(safe-area-inset-bottom))] lg:min-h-[calc(100dvh-4rem)]"
      aria-label={t("title")}
    >
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
            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-[var(--shadow-card)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
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

            <div
              role="tabpanel"
              id="analysis-panel-entry"
              aria-labelledby="analysis-tab-entry"
              hidden={tab !== "entry"}
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
                />
              ) : null}
            </div>

            <div
              role="tabpanel"
              id="analysis-panel-progress"
              aria-labelledby="analysis-tab-progress"
              hidden={tab !== "progress"}
            >
              {tab === "progress" ? (
                <AnalysisTabProgress
                  analysis={analysis}
                  extras={developmentExtras}
                  onRetryExtras={() => {
                    if (exam) void loadDevelopmentExtras(exam.id);
                  }}
                />
              ) : null}
            </div>

            <div
              role="tabpanel"
              id="analysis-panel-mistakes"
              aria-labelledby="analysis-tab-mistakes"
              hidden={tab !== "mistakes"}
            >
              {tab === "mistakes" ? (
                <AnalysisTabMistakes
                  activeMockExamId={activeMockExamId}
                  photoAccessState={photoAccessState}
                  analysis={analysis}
                  onCategorized={handlePhotoCategorized}
                  onRetryAccess={() => {
                    if (exam) void loadPhotoAccess(exam.id);
                  }}
                />
              ) : null}
            </div>
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
    </main>
  );
}

function ExamTypeGate() {
  const t = useTranslations("analysis");

  return (
    <Card>
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <span
          className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold capitalize"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--color-chip) 30%, transparent)",
            color: "var(--color-chip-text)",
            fontFamily: "var(--font-body)",
          }}
        >
          {t("needs_exam_chip")}
        </span>
        <p className="text-base" style={{ color: "var(--color-secondary)" }}>
          {t("needs_exam_desc")}
        </p>
        <Link
          href="/profile"
          className="flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-card)] px-6 py-3 text-base font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none sm:w-auto"
          style={{
            backgroundColor: "var(--color-btn)",
            boxShadow: "var(--shadow-card)",
            fontFamily: "var(--font-body)",
          }}
        >
          {t("needs_exam_cta")}
        </Link>
      </div>
    </Card>
  );
}
