"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { Button, Card, ProgressBar, SectionHeading, TextField } from "@mentor/ui";
import { FormError } from "../../../../components/form";
import { staggerItemVariants, staggerListVariants } from "../../../../lib/stagger-motion";
import { fetchPhotoAccess } from "../../../../lib/analiz";
import type { PhotoAccessDto } from "@mentor/types";
import { PhotoCategorizeCard } from "./photo-categorize-card";

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

function formatTrendDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

function emptyScores(subjects: ExamSubjectDto[]): Record<string, SubjectScores> {
  return Object.fromEntries(subjects.map((s) => [s.slug, { correct: "", wrong: "", blank: "" }]));
}

/**
 * Deneme analizi — D/Y/Boş girişi, sunucu hesaplı net, kişisel trend (sıralama yok).
 * Exam resolution follows identity `examType` + editorial calendar (same rule as countdown).
 */
export function AnalizShell() {
  const reduceMotion = useReducedMotion();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [scores, setScores] = useState<Record<string, SubjectScores>>({});
  const [lastResult, setLastResult] = useState<MockExamDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoAccess, setPhotoAccess] = useState<PhotoAccessDto | null>(null);

  useEffect(() => {
    let active = true;
    void fetchPhotoAccess()
      .then((a) => {
        if (active) setPhotoAccess(a);
      })
      .catch(() => {
        if (active) setPhotoAccess({ canCategorize: false, reason: "AI_DISABLED" });
      });
    return () => {
      active = false;
    };
  }, []);

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

        const [calendarRes, analysisRes] = await Promise.all([
          contentControllerCalendarByFamily(me.examType),
          http<CoachingAnalysisDto>(getAnalysisUrl()),
        ]);
        if (!active) return;

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
                : "Bir hata oluştu.",
        });
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const readyData = loadState.status === "ready" ? loadState.data : null;
  const exam = readyData?.exam ?? null;
  const subjects = readyData?.subjects ?? [];
  const analysis = readyData?.analysis ?? null;

  const maxTrendNet = useMemo(
    () =>
      analysis?.trend.length
        ? Math.max(...analysis.trend.map((t) => Number(t.totalNet)))
        : 0,
    [analysis],
  );

  const activeMockExamId = lastResult?.id ?? analysis?.trend[0]?.id ?? null;

  async function refreshAnalysis() {
    if (!exam || loadState.status !== "ready") return;
    const analysisRes = await http<CoachingAnalysisDto>(getAnalysisUrl());
    setLoadState({
      status: "ready",
      data: { exam, subjects, analysis: analysisRes },
    });
  }

  const headerMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
      };

  const gridMotion = reduceMotion
    ? {}
    : {
        initial: "hidden" as const,
        animate: "show" as const,
        variants: staggerListVariants,
      };

  function updateScore(slug: string, field: keyof SubjectScores, value: string) {
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
            : "Bir hata oluştu.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadState.status === "loading") {
    return (
      <main className="mx-auto flex min-h-[40vh] w-full max-w-2xl items-center justify-center px-5 py-8 lg:px-8">
        <p style={{ color: "var(--color-secondary)" }}>Yükleniyor…</p>
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
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          Deneme Analizi
        </h1>
        <p className="mt-1 text-base" style={{ color: "var(--color-secondary)" }}>
          Deneme sonuçlarını gir; netini ve gelişimini birlikte takip edelim.
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
                        backgroundColor: "color-mix(in srgb, var(--color-chip) 30%, transparent)",
                        color: "var(--color-chip-text)",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      Deneme kaydedildi
                    </span>
                    <p
                      className="text-xl font-bold"
                      style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
                    >
                      Toplam net: {lastResult.totalNet}
                    </p>
                    <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
                      {lastResult.examName}
                    </p>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {activeMockExamId && photoAccess ? (
            <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
              <PhotoCategorizeCard
                mockExamId={activeMockExamId}
                access={photoAccess}
                onCategorized={() => {
                  void refreshAnalysis().then(() =>
                    fetchPhotoAccess().then(setPhotoAccess).catch(() => undefined),
                  );
                }}
              />
            </motion.div>
          ) : null}

          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <Card>
              <SectionHeading subtitle={exam?.name}>
                Deneme sonucu gir
              </SectionHeading>

              {!exam || subjects.length === 0 ? (
                <NoExamSeed />
              ) : (
                <form onSubmit={(e) => void submit(e)} className="mt-4 flex flex-col gap-5">
                  {subjects.map((s) => (
                    <fieldset key={s.slug} className="flex flex-col gap-2">
                      <legend
                        className="text-sm font-bold"
                        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
                      >
                        {s.name}
                        {s.questionCount != null ? ` (${s.questionCount} soru)` : ""}
                      </legend>
                      <div className="grid grid-cols-3 gap-2">
                        <TextField
                          label="Doğru"
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={scores[s.slug]?.correct ?? ""}
                          onChange={(e) => updateScore(s.slug, "correct", e.target.value)}
                        />
                        <TextField
                          label="Yanlış"
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={scores[s.slug]?.wrong ?? ""}
                          onChange={(e) => updateScore(s.slug, "wrong", e.target.value)}
                        />
                        <TextField
                          label="Boş"
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={scores[s.slug]?.blank ?? ""}
                          onChange={(e) => updateScore(s.slug, "blank", e.target.value)}
                        />
                      </div>
                    </fieldset>
                  ))}
                  <Button type="submit" busy={submitting} fullWidth>
                    Kaydet
                  </Button>
                </form>
              )}
            </Card>
          </motion.div>

          <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
            <Card>
              <SectionHeading subtitle="Kişisel gelişim — sıralama yok">Net trendi</SectionHeading>
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
                      maxTrendNet > 0 ? Math.round((Number(point.totalNet) / maxTrendNet) * 100) : 0;
                    return (
                      <motion.li key={point.id} variants={reduceMotion ? undefined : staggerItemVariants}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span style={{ color: "var(--color-body)" }}>
                            {formatTrendDate(point.takenAt)}
                          </span>
                          <span
                            className="font-bold tabular-nums"
                            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
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
            <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
              <Card>
                <SectionHeading subtitle="Kişisel ortalamalar — sıralama yok">
                  Ders bazlı ortalamalar
                </SectionHeading>
                <ul className="mt-4 flex flex-col gap-3">
                  {analysis.subjects.map((s) => (
                    <li
                      key={s.subjectRef}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] px-3 py-2 text-sm transition-colors hover:bg-white/40 motion-reduce:transition-none"
                    >
                      <span style={{ color: "var(--color-body)" }}>{s.subjectName}</span>
                      <span className="tabular-nums" style={{ color: "var(--color-secondary)" }}>
                        Ort. {s.averageNet} · {s.attemptCount} deneme
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          )}

          {analysis && analysis.photoSubjectSignals.length > 0 && (
            <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
              <Card>
                <SectionHeading subtitle="Foto analizinden gelen ipuçları">
                  Ders sinyalleri
                </SectionHeading>
                <ul className="mt-4 flex flex-col gap-3">
                  {analysis.photoSubjectSignals.map((s) => (
                    <li
                      key={s.subjectRef}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] px-3 py-2 text-sm"
                    >
                      <span style={{ color: "var(--color-body)" }}>{s.subjectName}</span>
                      <span className="tabular-nums" style={{ color: "var(--color-secondary)" }}>
                        {s.count} foto
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
              style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
            >
              ← Panele dön
            </Link>
          </motion.div>
        </motion.div>
      )}
    </main>
  );
}

function ExamTypeGate() {
  return (
    <Card>
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <span
          className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold capitalize"
          style={{
            backgroundColor: "color-mix(in srgb, var(--color-chip) 30%, transparent)",
            color: "var(--color-chip-text)",
            fontFamily: "var(--font-body)",
          }}
        >
          Sınav türü gerekli
        </span>
        <p className="text-base" style={{ color: "var(--color-secondary)" }}>
          Deneme girişi için önce sınav türünü seçmelisin. Panel geri sayımı ve analiz bu bilgiyle
          açılır.
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
          Sınav türünü seç
        </Link>
      </div>
    </Card>
  );
}

function NoExamSeed() {
  return (
    <div className="mt-4 flex flex-col items-center gap-4 py-4 text-center">
      <span
        className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold capitalize"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-chip) 30%, transparent)",
          color: "var(--color-chip-text)",
          fontFamily: "var(--font-body)",
        }}
      >
        Ders listesi bekleniyor
      </span>
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        Sınav takvimi veya ders listesi henüz yayımlanmadı. Editorial içerik güncellendiğinde form burada
        açılacak.
      </p>
    </div>
  );
}

function EmptyTrend() {
  return (
    <div className="mt-4 flex flex-col items-center gap-4 py-6 text-center">
      <span
        className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold capitalize"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-chip) 30%, transparent)",
          color: "var(--color-chip-text)",
          fontFamily: "var(--font-body)",
        }}
      >
        Henüz trend yok
      </span>
      <p className="text-base" style={{ color: "var(--color-secondary)" }}>
        İlk denemeni kaydettiğinde net trendi burada görünecek. Her adım sayılır.
      </p>
    </div>
  );
}
