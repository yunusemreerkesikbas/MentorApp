"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ExamSubjectDto, MockExamDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import {
  Button,
  Card,
  SectionHeading,
  Skeleton,
  SkeletonGroup,
  skeletonStaggerStyle,
} from "@mentor/ui";
import { fetchMockExamsList } from "@/lib/mock-exams";
import { formatTrendDate } from "./analysis-types";
import { AnalysisHistoryDetail } from "./analysis-history-detail";

const PAGE_SIZE = 5;

interface AnalysisHistoryListProps {
  examId: string;
  refreshKey: number;
  subjects: ExamSubjectDto[];
  onCopyLast: (exam: MockExamDto) => void;
  onChanged: () => void;
}

export function AnalysisHistoryList({
  examId,
  refreshKey,
  subjects,
  onCopyLast,
  onChanged,
}: AnalysisHistoryListProps) {
  const t = useTranslations("analysis.history");
  const tAnalysis = useTranslations("analysis");
  const locale = useLocale();
  const [items, setItems] = useState<MockExamDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setItems([]);
    setPage(1);
    setTotal(0);
    setError(null);
    setMoreError(null);
    setSelectedId(null);
    try {
      const response = await fetchMockExamsList(1, PAGE_SIZE, examId);
      setItems(response.items);
      setTotal(response.total);
    } catch (loadError) {
      setError(toErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    // Deliberate fetch trigger after mount and mutations.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFirstPage();
  }, [loadFirstPage, refreshKey]);

  const loadMore = useCallback(async () => {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const nextPage = page + 1;
      const response = await fetchMockExamsList(
        nextPage,
        PAGE_SIZE,
        examId,
      );
      setItems((current) => [...current, ...response.items]);
      setPage(response.page);
      setTotal(response.total);
    } catch {
      setMoreError(t("load_more_error"));
    } finally {
      setLoadingMore(false);
    }
  }, [examId, items.length, loadingMore, page, t, total]);

  if (loading) {
    return <HistoryListSkeleton />;
  }

  if (error) {
    return (
      <Card className="flex flex-col items-start gap-3">
        <p className="text-sm" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
        <Button type="button" variant="secondary" onClick={() => void loadFirstPage()}>
          {t("retry")}
        </Button>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("empty")}
      </p>
    );
  }

  return (
    <>
      <Card>
        <SectionHeading as="h3">{t("title")}</SectionHeading>
        <ul
          className="mt-3 divide-y"
          style={{
            borderColor:
              "color-mix(in srgb, var(--color-main) 10%, transparent)",
          }}
        >
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSelectedId(item.id)}
                className="grid min-h-11 w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-[var(--radius-card)] px-2 py-3 text-left transition-colors duration-200 hover:bg-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
              >
                <span className="min-w-0">
                  <span
                    className="block truncate text-sm font-semibold"
                    style={{ color: "var(--color-main)" }}
                  >
                    {item.publisherName || t("publisher_fallback")}
                  </span>
                  <span
                    className="block text-xs"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {formatTrendDate(item.takenAt, locale)}
                  </span>
                </span>
                <span
                  className="text-right text-base font-bold tabular-nums"
                  style={{
                    color: "var(--color-main)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  {t("net", { net: item.totalNet })}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {items.length < total ? (
          <div className="mt-3 flex flex-col items-start gap-2 border-t pt-3">
            <Button
              type="button"
              variant="secondary"
              busy={loadingMore}
              onClick={() => void loadMore()}
            >
              {t("load_more")}
            </Button>
            {moreError ? (
              <div className="flex flex-wrap items-center gap-3" role="alert">
                <p
                  className="text-sm"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {moreError}
                </p>
                <button
                  type="button"
                  className="min-h-11 text-sm font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                  onClick={() => void loadMore()}
                >
                  {t("retry")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => onCopyLast(items[0]!)}
          className="mt-4 min-h-11 text-sm font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ color: "var(--color-main)" }}
        >
          {tAnalysis("copy_last")}
        </button>
      </Card>
      <AnalysisHistoryDetail
        mockExamId={selectedId}
        subjects={subjects}
        onClose={() => setSelectedId(null)}
        onChanged={onChanged}
      />
    </>
  );
}

function HistoryListSkeleton() {
  const t = useTranslations("analysis.history");

  return (
    <SkeletonGroup label={t("loading")} className="block">
      <Card>
        <Skeleton className="h-6 w-40 rounded-[var(--radius-card)]" />
        <div className="mt-3 flex flex-col">
          {Array.from({ length: PAGE_SIZE }, (_, index) => (
            <div
              key={index}
              className="grid min-h-16 grid-cols-[minmax(0,1fr)_5rem] items-center gap-4 border-t px-2 py-3 first:border-t-0"
              style={skeletonStaggerStyle(index)}
            >
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-32 rounded-[var(--radius-card)]" />
                <Skeleton className="h-3 w-20 rounded-[var(--radius-card)]" />
              </div>
              <Skeleton className="h-5 w-20 rounded-[var(--radius-card)]" />
            </div>
          ))}
        </div>
      </Card>
    </SkeletonGroup>
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : error instanceof Error
      ? error.message
      : String(error);
}

