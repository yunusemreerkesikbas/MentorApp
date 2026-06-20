"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
import {
  Button,
  Card,
  ProgressBar,
  SectionHeading,
  TextField,
} from "@mentor/ui";
import { FormError } from "@/components/form";
import { staggerItemVariants, staggerListVariants } from "@/lib/stagger-motion";
import { fetchPhotoAccess } from "@/lib/analiz";
import type { PhotoAccessDto } from "@mentor/types";
import { PhotoCategorizeCard } from "./photo-categorize-card";
import { GhostCard } from "./ghost-card";

interface SubjectScores {
  correct: string;
  wrong: string;
  blank: string;
}

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

function getAnalysisUrl(): string {
  return `/v1/coaching/analysis`;
}

function getMockExamsUrl(): string {
  return `/v1/mock-exams`;
}

function formatTrendDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function emptyScores(
  subjects: ExamSubjectDto[],
): Record<string, SubjectScores> {
  return Object.fromEntries(
    subjects.map((s) => [s.slug, { correct: "", wrong: "", blank: "" }]),
  );
}

/**
 * Deneme analizi — D/Y/Boş girişi, sunucu hesaplı net, kişisel trend (sıralama yok).
 * Exam resolution follows identity `examType` + editorial calendar (same rule as countdown).
 */
export function AnalizShell() {
  const t = useTranslations("analysis");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [scores, setScores] = useState<Record<string, SubjectScores>>({});
  const [lastResult, setLastResult] = useState<MockExamDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoAccess, setPhotoAccess] = useState<PhotoAccessDto | null>(null);
  const [photoAccessError, setPhotoAccessError] = useState<string | null>(null);

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

        const [calendarRes, analysisRes, photoAccessResult] = await Promise.all(
          [
            contentControllerCalendarByFamily(me.examType),
            http<CoachingAnalysisDto>(getAnalysisUrl()),
            fetchPhotoAccess().catch((err: unknown) => ({ error: err })),
          ],
        );
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
        const analysis = analysisRes;

        let subjectRows: ExamSubjectDto[] = [];
        if (current) {
          subjectRows = (await contentControllerSubjectsBySlug(
            current.slug,
          )) as unknown as ExamSubjectDto[];
          if (!active) return;
        }

        setScores(emptyScores(subjectRows));
        setLoadState({
          status: "ready",
          data: { exam: current, subjects: subjectRows, analysis },
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

  const maxTrendNet = useMemo(
    () =>
      analysis?.trend.length
        ? Math.max(...analysis.trend.map((t) => Number(t.totalNet)))
        : 0,
    [analysis],
  );

  const activeMockExamId = lastResult?.id ?? analysis?.trend[0]?.id ?? null;

  const refreshAnalysis = useCallback(async () => {
    if (!exam || loadState.status !== "ready") return;
    const analysisRes = await http<CoachingAnalysisDto>(getAnalysisUrl());
    setLoadState({
      status: "ready",
      data: { exam, subjects, analysis: analysisRes },
    });
  }, [exam, loadState.status, subjects]);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!exam || submitting || loadState.status !== "ready") return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        examId: exam.id,
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
      setLastResult(result);
      await refreshAnalysis();
      setScores(emptyScores(subjects));
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

  if (loadState.status === "loading") {
    return (
      <main className="mx-auto flex min-h-[40vh] w-full max-w-2xl items-center justify-center px-5 py-8 lg:px-8">
        <p style={{ color: "var(--color-secondary)" }}>{t("loading")}</p>
      </main>
    );
  }

  if (loadState.status === "error") {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-8 lg:px-8 lg:py-10">
        <FormError message={loadState.message} />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 lg:px-8 lg:py-10">
      <motion.header className="mb-6" {...headerMotion}>
        <h1
          className="text-3xl font-bold"
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
          <AnimatePresence>
            {lastResult && (
              <motion.div
                key="last-result"
                variants={reduceMotion ? undefined : staggerItemVariants}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              >
                <Card>
                  <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
                    <span
                      className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold"
                      style={{
                        backgroundColor:
                          "color-mix(in srgb, var(--color-chip) 30%, transparent)",
                        color: "var(--color-chip-text)",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {t("saved_chip")}
                    </span>
                    <p
                      className="text-xl font-bold"
                      style={{
                        color: "var(--color-main)",
                        fontFamily: "var(--font-heading)",
                      }}
                    >
                      {t("total_net", { net: lastResult.totalNet })}
                    </p>
                    <p
                      className="text-sm"
                      style={{ color: "var(--color-secondary)" }}
                    >
                      {lastResult.examName}
                    </p>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {activeMockExamId ? (
            <motion.div
              variants={reduceMotion ? undefined : staggerItemVariants}
            >
              {photoAccessError ? (
                <Card className="flex flex-col gap-3">
                  <SectionHeading as="h2" subtitle={t("photo_unavailable")}>
                    {t("photo_section_title")}
                  </SectionHeading>
                  <FormError message={photoAccessError} />
                </Card>
              ) : photoAccess ? (
                <PhotoCategorizeCard
                  mockExamId={activeMockExamId}
                  access={photoAccess}
                  onCategorized={handlePhotoCategorized}
                />
              ) : null}
            </motion.div>
          ) : null}

          {analysis?.ghost ? (
            <motion.div
              key={analysis.ghost.latest.id}
              variants={reduceMotion ? undefined : staggerItemVariants}
            >
              <GhostCard ghost={analysis.ghost} />
            </motion.div>
          ) : null}

          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <Card>
              <SectionHeading subtitle={exam?.name}>
                {t("result_entry_title")}
              </SectionHeading>

              {!exam || subjects.length === 0 ? (
                <NoExamSeed />
              ) : (
                <form
                  onSubmit={(e) => void submit(e)}
                  className="mt-4 flex flex-col gap-5"
                >
                  {subjects.map((s) => (
                    <fieldset key={s.slug} className="flex flex-col gap-2">
                      <legend
                        className="text-sm font-bold"
                        style={{
                          color: "var(--color-main)",
                          fontFamily: "var(--font-heading)",
                        }}
                      >
                        {s.name}
                        {s.questionCount != null
                          ? ` ${t("questions_count", { count: s.questionCount })}`
                          : ""}
                      </legend>
                      <div className="grid grid-cols-3 gap-2">
                        <TextField
                          label={t("correct")}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={scores[s.slug]?.correct ?? ""}
                          onChange={(e) =>
                            updateScore(s.slug, "correct", e.target.value)
                          }
                        />
                        <TextField
                          label={t("wrong")}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={scores[s.slug]?.wrong ?? ""}
                          onChange={(e) =>
                            updateScore(s.slug, "wrong", e.target.value)
                          }
                        />
                        <TextField
                          label={t("blank")}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={scores[s.slug]?.blank ?? ""}
                          onChange={(e) =>
                            updateScore(s.slug, "blank", e.target.value)
                          }
                        />
                      </div>
                    </fieldset>
                  ))}
                  <Button type="submit" busy={submitting} fullWidth>
                    {t("save")}
                  </Button>
                </form>
              )}
            </Card>
          </motion.div>

          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <Card>
              <SectionHeading subtitle={t("trend_subtitle")}>
                {t("trend_title")}
              </SectionHeading>
              {analysis && analysis.trend.length > 0 ? (
                <motion.ul
                  className="mt-4 flex flex-col gap-3"
                  initial={reduceMotion ? false : "hidden"}
                  animate={reduceMotion ? undefined : "show"}
                  variants={{
                    hidden: { opacity: 0 },
                    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
                  }}
                >
                  {analysis.trend.map((point) => {
                    const pct =
                      maxTrendNet > 0
                        ? Math.round(
                            (Number(point.totalNet) / maxTrendNet) * 100,
                          )
                        : 0;
                    return (
                      <motion.li
                        key={point.id}
                        variants={
                          reduceMotion ? undefined : staggerItemVariants
                        }
                      >
                        <div className="mb-1 flex justify-between text-sm">
                          <span style={{ color: "var(--color-body)" }}>
                            {formatTrendDate(point.takenAt, locale)}
                          </span>
                          <span
                            className="font-bold tabular-nums"
                            style={{
                              color: "var(--color-main)",
                              fontFamily: "var(--font-heading)",
                            }}
                          >
                            {point.totalNet}
                          </span>
                        </div>
                        <ProgressBar value={pct} />
                      </motion.li>
                    );
                  })}
                </motion.ul>
              ) : (
                <EmptyTrend />
              )}
            </Card>
          </motion.div>

          {analysis && analysis.subjects.length > 0 && (
            <motion.div
              variants={reduceMotion ? undefined : staggerItemVariants}
            >
              <Card>
                <SectionHeading subtitle={t("subject_avg_subtitle")}>
                  {t("subject_avg_title")}
                </SectionHeading>
                <ul className="mt-4 flex flex-col gap-3">
                  {analysis.subjects.map((s) => (
                    <li
                      key={s.subjectRef}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] px-3 py-2 text-sm transition-colors hover:bg-white/40 motion-reduce:transition-none"
                    >
                      <span style={{ color: "var(--color-body)" }}>
                        {s.subjectName}
                      </span>
                      <span
                        className="tabular-nums"
                        style={{ color: "var(--color-secondary)" }}
                      >
                        {t("avg_template", {
                          avg: s.averageNet,
                          count: s.attemptCount,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          )}

          {analysis && analysis.photoSubjectSignals.length > 0 && (
            <motion.div
              variants={reduceMotion ? undefined : staggerItemVariants}
            >
              <Card>
                <SectionHeading subtitle={t("photo_signals_subtitle")}>
                  {t("photo_signals_title")}
                </SectionHeading>
                <ul className="mt-4 flex flex-col gap-3">
                  {analysis.photoSubjectSignals.map((s) => (
                    <li
                      key={s.subjectRef}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] px-3 py-2 text-sm"
                    >
                      <span style={{ color: "var(--color-body)" }}>
                        {s.subjectName}
                      </span>
                      <span
                        className="tabular-nums"
                        style={{ color: "var(--color-secondary)" }}
                      >
                        {t("photo_count", { count: s.count })}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          )}

          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <Link
              href="/panel"
              className="flex min-h-[44px] items-center justify-center text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
              style={{
                color: "var(--color-main)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {t("back_panel")}
            </Link>
          </motion.div>
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

function NoExamSeed() {
  const translate = useTranslations("analysis");
  return (
    <div className="mt-4 flex flex-col items-center gap-4 py-4 text-center">
      <span
        className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold capitalize"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--color-chip) 30%, transparent)",
          color: "var(--color-chip-text)",
          fontFamily: "var(--font-body)",
        }}
      >
        {translate("no_seed_chip")}
      </span>
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {translate("no_seed_desc")}
      </p>
    </div>
  );
}

function EmptyTrend() {
  const t = useTranslations("analysis");

  return (
    <div className="mt-4 flex flex-col items-center gap-4 py-6 text-center">
      <span
        className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold capitalize"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--color-chip) 30%, transparent)",
          color: "var(--color-chip-text)",
          fontFamily: "var(--font-body)",
        }}
      >
        {t("empty_trend_chip")}
      </span>
      <p className="text-base" style={{ color: "var(--color-secondary)" }}>
        {t("empty_trend_desc")}
      </p>
    </div>
  );
}
