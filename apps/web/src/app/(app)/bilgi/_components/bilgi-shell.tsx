"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AuthUser, ExamCalendarDto, InfoArticleSummaryDto } from "@mentor/types";
import {
  ApiClientError,
  contentControllerCalendarByFamily,
  usersControllerMe,
} from "@mentor/api-client";
import { Card, DataCard } from "@mentor/ui";
import { FormError } from "../../../../components/form";
import { fetchInfoArticlesByFamily } from "../../../../lib/content-api";

const CATEGORY_LABELS: Record<string, string> = {
  APPLICATION: "Başvuru",
  EXAM_PROCESS: "Sınav süreci",
  GENERAL: "Genel",
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "no_exam_type" }
  | {
      status: "ready";
      examType: string;
      calendar: ExamCalendarDto | null;
      articles: InfoArticleSummaryDto[];
    };

/** Bilgi Merkezi — exam-day data card + editorial article list (guardrail #1). */
export function BilgiShell() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    usersControllerMe()
      .then(async (meRes) => {
        const me = meRes as unknown as AuthUser;
        if (!me.examType) {
          setState({ status: "no_exam_type" });
          return;
        }
        const [calRes, articlesRes] = await Promise.all([
          contentControllerCalendarByFamily(me.examType),
          fetchInfoArticlesByFamily(me.examType),
        ]);
        const calendar = calRes as unknown as ExamCalendarDto | null;
        setState({
          status: "ready",
          examType: me.examType,
          calendar: calendar?.examDateLabel ? calendar : null,
          articles: articlesRes.items,
        });
      })
      .catch((err: unknown) =>
        setState({
          status: "error",
          message:
            err instanceof ApiClientError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Bir hata oluştu.",
        }),
      );
  }, []);

  // Mount-time load goes through a ref: `load` sets state synchronously (fine from the
  // retry button's event handler), but the react-compiler rule forbids that call chain
  // directly inside an effect (same pattern as lib/auth-context.tsx).
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    loadRef.current();
  }, []);

  if (state.status === "loading") {
    return (
      <main className="mx-auto flex min-h-[40vh] w-full max-w-6xl items-center justify-center px-5 py-8">
        <p style={{ color: "var(--color-secondary)" }}>Yükleniyor…</p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8">
        <FormError message={state.message} />
      </main>
    );
  }

  if (state.status === "no_exam_type") {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8">
        <h1
          className="mb-4 text-2xl font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          Bilgi Merkezi
        </h1>
        <Card>
          <p className="text-base" style={{ color: "var(--color-secondary)" }}>
            Hedef sınavını profilden seçtiğinde resmî sınav tarihi ve makaleler burada görünecek.
          </p>
        </Card>
      </main>
    );
  }

  const { calendar, articles } = state;
  const examDateEvent = calendar?.events.find((e) => e.type === "EXAM_DATE");
  const verifiedLabel = examDateEvent
    ? new Date(examDateEvent.verifiedAt).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
      <header className="mb-6">
        <h1
          className="text-2xl font-bold lg:text-3xl"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          Bilgi Merkezi
        </h1>
        <p className="mt-1 text-base" style={{ color: "var(--color-secondary)" }}>
          Resmî bilgi — kaynaklı ve doğrulanmış içerik.
        </p>
      </header>

      {calendar ? (
        <DataCard
          label="Sınav günü"
          value={calendar.examDateLabel}
          caption={
            <>
              <span className="font-semibold" style={{ color: "var(--color-main)" }}>
                {calendar.exam.name}
              </span>
              {calendar.daysRemaining !== null ? (
                <span className="mt-1 block">
                  Sınava {calendar.daysRemaining} gün kaldı.
                </span>
              ) : null}
              {verifiedLabel ? (
                <span className="mt-1 block text-xs" style={{ color: "var(--color-secondary)" }}>
                  Son doğrulama: {verifiedLabel}
                </span>
              ) : null}
            </>
          }
          source={
            examDateEvent
              ? { label: examDateEvent.source, url: examDateEvent.sourceUrl }
              : undefined
          }
        />
      ) : (
        <Card className="mb-6">
          <p className="text-base" style={{ color: "var(--color-secondary)" }}>
            Sınav takvimi henüz yayımlanmadı.
          </p>
        </Card>
      )}

      <section className="mt-8">
        <h2
          className="mb-4 text-lg font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          Makaleler
        </h2>
        {articles.length === 0 ? (
          <Card>
            <p className="text-base" style={{ color: "var(--color-secondary)" }}>
              Bu sınav için henüz makale yok.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {articles.map((article) => (
              <li key={article.slug}>
                <Link href={`/bilgi/${article.slug}`}>
                  <Card className="transition-opacity hover:opacity-90">
                    <p
                      className="text-base font-semibold"
                      style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
                    >
                      {article.title}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
                      {CATEGORY_LABELS[article.category] ?? article.category}
                      {" · "}
                      Kaynak: {article.source}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
