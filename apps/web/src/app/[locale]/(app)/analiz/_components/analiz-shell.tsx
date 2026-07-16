"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useMentorToast } from "@/lib/mentor-toast";
import { fetchPhotoAccess } from "@/lib/analiz";
import { AnalizContentSkeleton } from "./analiz-content-skeleton";
import { AnalizSegmentControl } from "./analiz-segment-control";
import { AnalizSummaryBand } from "./analiz-summary-band";
import { AnalizTabGelisim } from "./analiz-tab-gelisim";
import { AnalizTabGir } from "./analiz-tab-gir";
import { AnalizTabYanlislarim } from "./analiz-tab-yanlislarim";
import {
  buildAnalizTabHref,
  emptyScores,
  parseAnalizTab,
  scoresFromMockExam,
  shouldNavigateAnalizTab,
  shouldRevealFirstInsight,
  type AnalizTab,
  type SubjectScores,
} from "./analiz-types";

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
export function AnalizShell() {
  const t = useTranslations("analysis");
  const toast = useMentorToast();
  const searchParams = useSearchParams();
  const [tab, setActiveTab] = useState<AnalizTab>(() =>
    parseAnalizTab(searchParams.get("tab")),
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
  const entryScrollRequested = useRef(false);

  const setTab = useCallback(
    (next: AnalizTab) => {
      if (!shouldNavigateAnalizTab(tab, next)) return;
      setActiveTab(next);
      window.history.replaceState(
        window.history.state,
        "",
        buildAnalizTabHref(
          window.location.pathname,
          window.location.search,
          next,
        ),
      );
    },
    [tab],
  );

  const activateEntryForm = useCallback(() => {
    const form = document.getElementById("analiz-form");
    form?.scrollIntoView({ block: "start" });
    form
      ?.querySelector<HTMLInputElement>('input[type="number"]')
      ?.focus({ preventScroll: true });
  }, []);

  const openEntryForm = useCallback(() => {
    if (tab === "gir") {
      activateEntryForm();
      return;
    }
    entryScrollRequested.current = true;
    setTab("gir");
  }, [activateEntryForm, setTab, tab]);

  useEffect(() => {
    if (tab !== "gir" || !entryScrollRequested.current) return;
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
    if (!exam || tab !== "gelisim") return;
    if (
      developmentExtras.examId === exam.id &&
      developmentExtras.status !== "idle"
    ) {
      return;
    }
    void loadDevelopmentExtras(exam.id);
  }, [developmentExtras, exam, loadDevelopmentExtras, tab]);

  useEffect(() => {
    if (!exam || tab !== "yanlislar") return;
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
        setTab("gelisim");
        requestAnimationFrame(() => {
          document.getElementById("analiz-tab-gelisim")?.focus();
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
    return <AnalizContentSkeleton />;
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

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-10">
      <header className="mb-6">
        <h1
          className="text-3xl font-bold text-balance"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {t("title")}
        </h1>
        <p
          className="mt-1 text-base"
          style={{ color: "var(--color-secondary)" }}
        >
          {t("subtitle")}
        </p>
      </header>

      <FormError message={error} />

      {loadState.status === "needs_exam_type" ? (
        <ExamTypeGate />
      ) : (
        <div className="flex flex-col gap-6">
          <AnalizSummaryBand analysis={analysis} onNewEntry={openEntryForm} />

          <AnalizSegmentControl value={tab} onChange={setTab} />

          <div
            role="tabpanel"
            id="analiz-panel-gir"
            aria-labelledby="analiz-tab-gir"
            hidden={tab !== "gir"}
          >
            {tab === "gir" ? (
              <AnalizTabGir
                examId={exam?.id ?? ""}
                exam={exam}
                subjects={subjects}
                scores={scores}
                submitting={submitting}
                historyRefreshKey={historyRefreshKey}
                publisherName={publisherName}
                takenAtDate={takenAtDate}
                onPublisherChange={setPublisherName}
                onTakenAtChange={setTakenAtDate}
                onScoreChange={updateScore}
                onSubmit={(event) => void submit(event)}
                onCopyLast={handleCopyLast}
                onHistoryChanged={handleHistoryChanged}
              />
            ) : null}
          </div>

          <div
            role="tabpanel"
            id="analiz-panel-gelisim"
            aria-labelledby="analiz-tab-gelisim"
            hidden={tab !== "gelisim"}
          >
            {tab === "gelisim" ? (
              <AnalizTabGelisim
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
            id="analiz-panel-yanlislar"
            aria-labelledby="analiz-tab-yanlislar"
            hidden={tab !== "yanlislar"}
          >
            {tab === "yanlislar" ? (
              <AnalizTabYanlislarim
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
      )}
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
          href="/profil"
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
