"use client";

import { useCallback, useEffect, useState } from "react";
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

interface SubjectScores {
  correct: string;
  wrong: string;
  blank: string;
}

function getAnalysisUrl(): string {
  return `/v1/coaching/analysis`;
}

function getMockExamsUrl(): string {
  return `/v1/mock-exams`;
}

function formatTrendDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Deneme analizi — D/Y/Boş girişi, sunucu hesaplı net, kişisel trend (sıralama yok).
 * Exam resolution follows identity `examType` + editorial calendar (same rule as countdown).
 */
export function AnalizShell() {
  const [exam, setExam] = useState<ExamSummaryDto | null>(null);
  const [subjects, setSubjects] = useState<ExamSubjectDto[]>([]);
  const [scores, setScores] = useState<Record<string, SubjectScores>>({});
  const [analysis, setAnalysis] = useState<CoachingAnalysisDto | null>(null);
  const [lastResult, setLastResult] = useState<MockExamDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = (await usersControllerMe()) as unknown as AuthUser;
      if (!me.examType) {
        setExam(null);
        setSubjects([]);
        setError("Deneme girişi için profilden sınav türünü seçmelisin.");
        return;
      }

      const [calendarRes, analysisRes] = await Promise.all([
        contentControllerCalendarByFamily(me.examType),
        http<CoachingAnalysisDto>(getAnalysisUrl()),
      ]);

      const calendar = calendarRes as unknown as ExamCalendarDto | null;
      const current = calendar?.exam ?? null;
      setExam(current);
      setAnalysis(analysisRes);

      if (current) {
        const subjectRows = (await contentControllerSubjectsBySlug(
          current.slug,
        )) as unknown as ExamSubjectDto[];
        setSubjects(subjectRows);
        setScores(
          Object.fromEntries(
            subjectRows.map((s) => [s.slug, { correct: "", wrong: "", blank: "" }]),
          ),
        );
      } else {
        setSubjects([]);
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Bir hata oluştu.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateScore(slug: string, field: keyof SubjectScores, value: string) {
    setScores((prev) => ({
      ...prev,
      [slug]: { ...prev[slug]!, [field]: value },
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!exam || submitting) return;
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
      const analysisRes = await http<CoachingAnalysisDto>(getAnalysisUrl());
      setAnalysis(analysisRes);
      setScores(
        Object.fromEntries(
          subjects.map((s) => [s.slug, { correct: "", wrong: "", blank: "" }]),
        ),
      );
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

  const maxTrendNet = analysis?.trend.length
    ? Math.max(...analysis.trend.map((t) => Number(t.totalNet)))
    : 0;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 lg:px-8 lg:py-10">
      <header className="mb-6">
        <h1
          className="text-3xl font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          Deneme Analizi
        </h1>
        <p className="mt-1 text-base" style={{ color: "var(--color-secondary)" }}>
          Deneme sonuçlarını gir; netini ve gelişimini birlikte takip edelim.
        </p>
      </header>

      <FormError message={error} />

      {loading ? (
        <p style={{ color: "var(--color-secondary)" }}>Yükleniyor…</p>
      ) : (
        <div className="flex flex-col gap-6">
          {lastResult && (
            <Card>
              <p
                className="text-base font-bold"
                style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
              >
                Son deneme netin: {lastResult.totalNet}
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
                {lastResult.examName}
              </p>
            </Card>
          )}

          <Card>
            <SectionHeading subtitle={exam?.name}>
              Deneme sonucu gir
            </SectionHeading>

            {!exam || subjects.length === 0 ? (
              <p className="mt-4 text-sm" style={{ color: "var(--color-secondary)" }}>
                Sınav ve ders listesi henüz yüklenemedi.
              </p>
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

          {analysis && analysis.trend.length > 0 && (
            <Card>
              <SectionHeading>Net trendi</SectionHeading>
              <ul className="mt-4 flex flex-col gap-3">
                {analysis.trend.map((point) => {
                  const pct =
                    maxTrendNet > 0 ? Math.round((Number(point.totalNet) / maxTrendNet) * 100) : 0;
                  return (
                    <li key={point.id}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span style={{ color: "var(--color-body)" }}>
                          {formatTrendDate(point.takenAt)}
                        </span>
                        <span
                          className="font-bold"
                          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
                        >
                          {point.totalNet}
                        </span>
                      </div>
                      <ProgressBar value={pct} />
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {analysis && analysis.subjects.length > 0 && (
            <Card>
              <SectionHeading subtitle="Kişisel ortalamalar — sıralama yok">
                Ders bazlı ortalamalar
              </SectionHeading>
              <ul className="mt-4 flex flex-col gap-3">
                {analysis.subjects.map((s) => (
                  <li
                    key={s.subjectRef}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span style={{ color: "var(--color-body)" }}>{s.subjectName}</span>
                    <span style={{ color: "var(--color-secondary)" }}>
                      Ort. {s.averageNet} · {s.attemptCount} deneme
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </main>
  );
}
