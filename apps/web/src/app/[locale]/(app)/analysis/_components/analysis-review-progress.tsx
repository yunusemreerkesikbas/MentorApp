"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { http } from "@mentor/api-client";
import type {
  NotebookReviewSummary,
  NotebookReviewHistoryItem,
  Paginated,
  CoachingAnalysisDto,
} from "@mentor/types";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button, Card, Skeleton, SlidingTabs } from "@mentor/ui";

import { MenuSelect } from "@/components/menu-select";
import { Link } from "@/i18n/navigation";

import { AnalysisReviewHistory } from "./analysis-review-history";
import styles from "./analysis-review-progress.module.css";
import { AnalysisImprovementLoopCard } from "./analysis-improvement-loop-card";

export function AnalysisReviewProgress({
  examId,
  analysis,
}: {
  examId: string;
  analysis: CoachingAnalysisDto | null;
}) {
  const t = useTranslations("analysis.review");
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
  const focusOptions = [
    { value: "|", label: t("all") },
    ...Array.from(choices, ([value, label]) => ({ value, label })),
  ];
  return (
    <div className={styles.workspace}>
      <section className={styles.focus} aria-labelledby="review-focus-heading">
        <div className={styles.focusBody}>
          <h2 id="review-focus-heading" className={styles.eyebrow}>
            {t("focus")}
          </h2>
          <div className={styles.focusField}>
            <span id="review-focus-label" className={styles.focusLabel}>
              {t("choose")}
            </span>
            <MenuSelect
              id="analysis-review-focus"
              className={styles.focusSelect}
              value={focus}
              options={focusOptions}
              aria-labelledby="review-focus-label"
              onChange={(value) => {
                setFocus(value);
                setPage(1);
              }}
            />
          </div>
          {focus ===
            [
              analysis?.nextFocus?.subjectRef ?? "",
              analysis?.nextFocus?.topicRef ?? "",
            ].join("|") && (
            <p className={styles.reason}>{analysis?.nextFocus?.message}</p>
          )}
        </div>
        {data && (
          <Link
            className={styles.start}
            href={{ pathname: "/notebook", query: reviewQuery }}
          >
            {t("start", { count: data.summary.dueCount })}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        )}
        {analysis && (
          <details className={styles.plan}>
            <summary>
              {t("plan")}
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <AnalysisImprovementLoopCard
              embedded
              analysis={analysis}
              examId={examId}
            />
          </details>
        )}
      </section>
      <SlidingTabs
        items={[7, 30].map((value) => ({
          id: String(value),
          label: t("days", { count: value }),
        }))}
        value={String(days)}
        onChange={(value) => {
          setDays(Number(value));
          setPage(1);
        }}
        ariaLabel={t("period")}
        className={styles.period}
        idPrefix="analysis-review-period"
        equalWidth
      />
      {error ? (
        <Card>
          <p role="alert">{t("error")}</p>
          <Button onClick={() => setRetry((r) => r + 1)}>{t("retry")}</Button>
        </Card>
      ) : !data ? (
        <div role="status" aria-label={t("loading")}>
          <span className="sr-only">{t("loading")}</span>
          <div className={styles.metrics}>
            {[0, 1, 2, 3].map((key) => (
              <div key={key} className={styles.metric}>
                <Skeleton className="h-4 w-24 max-w-full rounded" />
                <Skeleton className="h-9 w-12 rounded" />
              </div>
            ))}
          </div>
          <Skeleton className={styles.historySkeleton} />
        </div>
      ) : (
        <>
          <dl className={styles.metrics}>
            {(
              [
                "workedCount",
                "revisitCount",
                "completedCount",
                "dueCount",
              ] as const
            ).map((key) => (
              <div key={key} className={styles.metric}>
                <dt>{t(key)}</dt>
                <dd className={styles.metricValue}>
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
              </div>
            ))}
          </dl>
          <p className={styles.note}>{t("dueNote")}</p>
          <AnalysisReviewHistory
            history={data.history}
            reviewQuery={reviewQuery}
            page={page}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
