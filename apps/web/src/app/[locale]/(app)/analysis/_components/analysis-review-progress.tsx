"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { http } from "@mentor/api-client";
import type {
  NotebookReviewSummary,
  NotebookReviewHistoryItem,
  Paginated,
  CoachingAnalysisDto,
} from "@mentor/types";
import { Card, Button } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { AnalysisImprovementLoopCard } from "./analysis-improvement-loop-card";

export function AnalysisReviewProgress({
  examId,
  analysis,
}: {
  examId: string;
  analysis: CoachingAnalysisDto | null;
}) {
  const t = useTranslations("analysis.review");
  const locale = useLocale();
  const params = useSearchParams();
  const [focus, setFocus] = useState(
    () =>
      params.get("focus") ??
      [
        analysis?.nextFocus?.subjectRef ?? "",
        analysis?.nextFocus?.topicRef ?? "",
      ].join("|"),
  );
  const [days, setDays] = useState(() =>
    params.get("days") === "30" ? 30 : 7,
  );
  const [page, setPage] = useState(1);
  const [result, setData] = useState<{
    key: string;
    summary: NotebookReviewSummary;
    history: Paginated<NotebookReviewHistoryItem>;
  } | null>(null);
  const [errorKey, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [subjectRef, topicRef] = focus.split("|");
  const query = new URLSearchParams({
    examId,
    days: String(days),
    page: String(page),
    pageSize: "10",
  });
  if (subjectRef) query.set("subjectRef", subjectRef);
  if (topicRef) query.set("topicRef", topicRef);
  const queryString = query.toString();
  const loadKey = queryString + ":" + retry;
  const data = result?.key === loadKey ? result : null;
  const error = errorKey === loadKey;
  useEffect(() => {
    let active = true;
    Promise.all([
      http<NotebookReviewSummary>(
        "/v1/coaching/notebook/review-summary?" + queryString,
      ),
      http<Paginated<NotebookReviewHistoryItem>>(
        "/v1/coaching/notebook/review-history?" + queryString,
      ),
    ])
      .then(([summary, history]) => {
        if (active) setData({ key: loadKey, summary, history });
      })
      .catch(() => {
        if (active) setError(loadKey);
      });
    return () => {
      active = false;
    };
  }, [queryString, loadKey]);
  const reviewQuery = {
    review: "focus",
    examId,
    ...(subjectRef && { subjectRef }),
    ...(topicRef && { topicRef }),
    focus,
    days: String(days),
  };
  const choices = new Map<string, string>();
  result?.summary.focuses.forEach((f) => {
    if (!f.subjectRef) return;
    choices.set(f.subjectRef + "|", f.subjectName ?? f.subjectRef);
    if (f.topicRef)
      choices.set(
        f.subjectRef + "|" + f.topicRef,
        (f.subjectName ?? f.subjectRef) + " · " + (f.topicName ?? f.topicRef),
      );
  });
  if (focus && focus !== "|" && !choices.has(focus))
    choices.set(
      focus,
      [analysis?.nextFocus?.subjectName, analysis?.nextFocus?.topicName]
        .filter(Boolean)
        .join(" · ") || focus,
    );
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{t("focus")}</h2>
        <label className="flex min-w-0 flex-col gap-2">
          {t("choose")}
          <select
            className="min-h-11 w-full min-w-0 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2"
            value={focus}
            onChange={(e) => {
              setFocus(e.target.value);
              setPage(1);
            }}
          >
            <option value="|">{t("all")}</option>
            {[...choices].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {focus ===
          [
            analysis?.nextFocus?.subjectRef ?? "",
            analysis?.nextFocus?.topicRef ?? "",
          ].join("|") && <p>{analysis?.nextFocus?.message}</p>}
        {data && (
          <Link
            className="min-h-11 font-semibold underline"
            href={{ pathname: "/notebook", query: reviewQuery }}
          >
            {t("start", { count: data.summary.dueCount })}
          </Link>
        )}
        {analysis && (
          <details open>
            <summary className="min-h-11 cursor-pointer">{t("plan")}</summary>
            <AnalysisImprovementLoopCard analysis={analysis} examId={examId} />
          </details>
        )}
      </Card>
      <div className="flex gap-3" role="group" aria-label={t("period")}>
        {[7, 30].map((value) => (
          <Button
            key={value}
            onClick={() => {
              setDays(value);
              setPage(1);
            }}
            aria-pressed={days === value}
          >
            {t("days", { count: value })}
          </Button>
        ))}
      </div>
      {error ? (
        <Card>
          <p role="alert">{t("error")}</p>
          <Button onClick={() => setRetry((r) => r + 1)}>{t("retry")}</Button>
        </Card>
      ) : !data ? (
        <Card>
          <p role="status">{t("loading")}</p>
        </Card>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(
              [
                "workedCount",
                "revisitCount",
                "completedCount",
                "dueCount",
              ] as const
            ).map((key) => (
              <Card key={key} className="min-w-0 break-words">
                <dt>{t(key)}</dt>
                <dd className="text-2xl font-bold tabular-nums">
                  {key === "revisitCount" && data.summary[key] > 0 ? (
                    <Link
                      className="underline"
                      href={{
                        pathname: "/notebook",
                        query: { ...reviewQuery, revisit: "true" },
                      }}
                    >
                      {data.summary[key]}
                    </Link>
                  ) : (
                    data.summary[key]
                  )}
                </dd>
              </Card>
            ))}
          </dl>
          <p className="text-sm">{t("dueNote")}</p>
          <Card>
            <h2 className="text-xl font-semibold">{t("history")}</h2>
            <p className="my-3 text-sm">{t("historyNote")}</p>
            {data.history.items.length === 0 ? (
              <p>{t("empty")}</p>
            ) : (
              <ul className="divide-y">
                {data.history.items.map((item) => (
                  <li key={item.id} className="py-3">
                    <Link
                      className="underline"
                      href={{
                        pathname: "/notebook",
                        query: { ...reviewQuery, entryId: item.entryId },
                      }}
                    >
                      {[item.subjectName, item.topicName]
                        .filter(Boolean)
                        .join(" · ") || t("unlabelled")}
                    </Link>
                    <p>
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Europe/Istanbul",
                      }).format(new Date(item.reviewedAt))}{" "}
                      · {t(item.solved ? "solved" : "missed")}
                      {item.early ? " · " + t("early") : ""}
                    </p>
                    <p>
                      {item.nextReviewAt
                        ? t("next", {
                            date: new Intl.DateTimeFormat(locale, {
                              dateStyle: "medium",
                              timeZone: "Europe/Istanbul",
                            }).format(new Date(item.nextReviewAt)),
                          })
                        : t("noNext")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex gap-3">
              <Button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("previous")}
              </Button>
              <Button
                disabled={page * 10 >= data.history.total}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("more")}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
