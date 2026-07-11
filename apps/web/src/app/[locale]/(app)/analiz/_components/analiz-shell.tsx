"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import type {
  AuthUser,
  CoachAccessDto,
  CoachingAnalysisDto,
  ExamCalendarDto,
  ExamSubjectDto,
  ExamSummaryDto,
  MockExamDto,
  WeeklyReviewDto,
} from "@mentor/types";
import {
  aiChatControllerGetAccess,
  ApiClientError,
  contentControllerCalendarByFamily,
  contentControllerSubjectsBySlug,
  http,
  usersControllerMe,
} from "@mentor/api-client";
import { Card } from "@mentor/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { useMentorToast } from "@/lib/mentor-toast";
import { fetchPhotoAccess } from "@/lib/analiz";
import type { PhotoAccessDto } from "@mentor/types";
import { staggerListVariants } from "@/lib/stagger-motion";
import { AnalizContentSkeleton } from "./analiz-content-skeleton";
import { AnalizSegmentControl } from "./analiz-segment-control";
import { AnalizSummaryBand } from "./analiz-summary-band";
import { AnalizTabGelisim } from "./analiz-tab-gelisim";
import { AnalizTabGir } from "./analiz-tab-gir";
import { AnalizTabYanlislarim } from "./analiz-tab-yanlislarim";
import {
  emptyScores,
  parseAnalizTab,
  scoresFromMockExam,
  type AnalizTab,
  type SubjectScores,
} from "./analiz-types";

type ReadyData = {
  exam: ExamSummaryDto | null;
  subjects: ExamSubjectDto[];
  analysis: CoachingAnalysisDto | null;
  weeklyReview: WeeklyReviewDto | null;
  weeklyReviewError: string | null;
  coachAccess: CoachAccessDto | null;
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

function getWeeklyReviewUrl(examId: string): string {
  return `/v1/coaching/weekly-review?examId=${encodeURIComponent(examId)}`;
}

function getMockExamsUrl(): string {
  return `/v1/mock-exams`;
}

/**
 * Deneme analizi — 3 mod (Gir / Gelişim / Yanlışlarım), sunucu hesaplı net, kişisel trend.
 */
export function AnalizShell() {
  const t = useTranslations("analysis");
  const toast = useMentorToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  const tab = parseAnalizTab(searchParams.get("tab"));

  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [scores, setScores] = useState<Record<string, SubjectScores>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [publisherName, setPublisherName] = useState("");
  const [takenAtDate, setTakenAtDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [photoAccess, setPhotoAccess] = useState<PhotoAccessDto | null>(null);
  const [photoAccessError, setPhotoAccessError] = useState<string | null>(null);

  const setTab = useCallback(
    (next: AnalizTab) => {
      router.replace(`/analiz?tab=${next}`);
    },
    [router],
  );

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

        const [calendarRes, photoAccessResult, coachAccessResult] = await Promise.all([
          contentControllerCalendarByFamily(me.examType),
          fetchPhotoAccess().catch((err: unknown) => ({ error: err })),
          aiChatControllerGetAccess().catch(() => null),
        ]);
        if (!active) return;

        if ("error" in photoAccessResult) {
          const err = photoAccessResult.error;
          setPhotoAccess(null);
          setPhotoAccessError(
            err instanceof Error ? err.message : t("photo_access_error"),
          );
        } else {
          setPhotoAccess(photoAccessResult);
          setPhotoAccessError(null);
        }

        const calendar = calendarRes as unknown as ExamCalendarDto | null;
        const current = calendar?.exam ?? null;
        const [analysis, subjectRows, weeklyResult] = current
          ? await Promise.all([
              http<CoachingAnalysisDto>(getAnalysisUrl(current.id)),
              contentControllerSubjectsBySlug(current.slug) as unknown as Promise<
                ExamSubjectDto[]
              >,
              http<WeeklyReviewDto>(getWeeklyReviewUrl(current.id)).catch(
                (error: unknown) => ({ error }),
              ),
            ])
          : [null, [], null];
        if (!active) return;

        setScores(emptyScores(subjectRows));
        setLoadState({
          status: "ready",
          data: {
            exam: current,
            subjects: subjectRows,
            analysis,
            weeklyReview:
              weeklyResult && !("error" in weeklyResult) ? weeklyResult : null,
            weeklyReviewError:
              weeklyResult && "error" in weeklyResult
                ? weeklyResult.error instanceof Error
                  ? weeklyResult.error.message
                  : t("weekly.load_error")
                : null,
            coachAccess: coachAccessResult
              ? ((coachAccessResult as unknown as { data?: CoachAccessDto }).data ??
                (coachAccessResult as unknown as CoachAccessDto))
              : null,
          },
        });
      } catch (err) {
        if (!active) return;
        setLoadState({
          status: "error",
          message:
            err instanceof ApiClientError
              ? err.message
              : err instanceof Error
                ? err.message
                : String(err),
        });
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [t]);

  const readyData = loadState.status === "ready" ? loadState.data : null;
  const exam = readyData?.exam ?? null;
  const subjects = useMemo(
    () => readyData?.subjects ?? [],
    [readyData?.subjects],
  );
  const analysis = readyData?.analysis ?? null;
  const personalRecordNet = analysis?.personalRecordNet ?? null;

  const activeMockExamId = analysis?.trend[0]?.id ?? null;

  const refreshAnalysis = useCallback(async () => {
    if (!exam || loadState.status !== "ready") return;
    const [analysisRes, weeklyResult] = await Promise.all([
      http<CoachingAnalysisDto>(getAnalysisUrl(exam.id)),
      http<WeeklyReviewDto>(getWeeklyReviewUrl(exam.id)).catch(
        (refreshError: unknown) => ({ error: refreshError }),
      ),
    ]);
    setLoadState({
      status: "ready",
      data: {
        ...loadState.data,
        exam,
        subjects,
        analysis: analysisRes,
        weeklyReview:
          !("error" in weeklyResult) ? weeklyResult : loadState.data.weeklyReview,
        weeklyReviewError:
          "error" in weeklyResult
            ? weeklyResult.error instanceof Error
              ? weeklyResult.error.message
              : t("weekly.load_error")
            : null,
      },
    });
  }, [exam, loadState, subjects, t]);

  const handleHistoryChanged = useCallback(() => {
    setHistoryRefreshKey((key) => key + 1);
    void refreshAnalysis();
  }, [refreshAnalysis]);

  const handlePhotoCategorized = useCallback(() => {
    void Promise.all([
      refreshAnalysis(),
      fetchPhotoAccess()
        .then((access) => {
          setPhotoAccess(access);
          setPhotoAccessError(null);
        })
        .catch((err: unknown) => {
          setPhotoAccess(null);
          setPhotoAccessError(
            err instanceof Error ? err.message : t("photo_access_error"),
          );
        }),
    ]);
  }, [refreshAnalysis, t]);

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
      setTab("gir");
      requestAnimationFrame(() => {
        document.getElementById("analiz-form")?.scrollIntoView({ behavior: "smooth" });
      });
    },
    [subjects, setTab],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!exam || submitting || loadState.status !== "ready") return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        examId: exam.id,
        ...(publisherName.trim() ? { publisherName: publisherName.trim() } : {}),
        ...(takenAtDate
          ? { takenAt: new Date(`${takenAtDate}T12:00:00`).toISOString() }
          : {}),
        subjects: subjects.map((s) => ({
          subjectRef: s.slug,
          correct: Number(scores[s.slug]?.correct || 0),
          wrong: Number(scores[s.slug]?.wrong || 0),
          blank: Number(scores[s.slug]?.blank || 0),
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
      await refreshAnalysis();
      setHistoryRefreshKey((k) => k + 1);
      setScores(emptyScores(subjects));
      setPublisherName("");
      setTakenAtDate(new Date().toISOString().slice(0, 10));
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const headerMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: "easeOut" as const },
        },
      };

  const gridMotion = reduceMotion
    ? {}
    : {
        initial: "hidden" as const,
        animate: "show" as const,
        variants: staggerListVariants,
      };

  if (loadState.status === "loading") {
    return <AnalizContentSkeleton />;
  }

  if (loadState.status === "error") {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-10">
        <FormError message={loadState.message} />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-10">
      <motion.header className="mb-6" {...headerMotion}>
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
      </motion.header>

      <FormError message={error} />

      {loadState.status === "needs_exam_type" ? (
        <ExamTypeGate />
      ) : (
        <motion.div className="flex flex-col gap-6" {...gridMotion}>
          <AnalizSummaryBand
            analysis={analysis}
            onNewEntry={() => {
              setTab("gir");
              requestAnimationFrame(() => {
                document
                  .getElementById("analiz-form")
                  ?.scrollIntoView({ behavior: "smooth" });
              });
            }}
          />

          <AnalizSegmentControl value={tab} onChange={setTab} />

          <div
            role="tabpanel"
            id={`analiz-panel-${tab}`}
            aria-labelledby={`analiz-tab-${tab}`}
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
                onSubmit={(e) => void submit(e)}
                onCopyLast={handleCopyLast}
                onHistoryChanged={handleHistoryChanged}
              />
            ) : null}
            {tab === "gelisim" ? (
              <AnalizTabGelisim
                examId={exam?.id ?? ""}
                analysis={analysis}
                personalRecordNet={personalRecordNet}
                weeklyReview={readyData?.weeklyReview ?? null}
                weeklyReviewError={readyData?.weeklyReviewError ?? null}
                premium={readyData?.coachAccess?.mode === "PREMIUM"}
              />
            ) : null}
            {tab === "yanlislar" ? (
              <AnalizTabYanlislarim
                activeMockExamId={activeMockExamId}
                photoAccess={photoAccess}
                photoAccessError={photoAccessError}
                analysis={analysis}
                onCategorized={handlePhotoCategorized}
              />
            ) : null}
          </div>
        </motion.div>
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




