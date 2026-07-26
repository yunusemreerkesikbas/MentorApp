"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down.mjs";
import { useLocale, useTranslations } from "next-intl";
import type { ExamSubjectDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import {
  Button,
  Skeleton,
  SkeletonGroup,
  skeletonStaggerStyle,
} from "@mentor/ui";
import { fetchMockExamsList } from "@/lib/mock-exams";
import { formatTrendDate } from "./analysis-types";
import { AnalysisHistoryDetail } from "./analysis-history-detail";

const PAGE_SIZE = 5;

/** Slide-up content; container height uses CSS grid (avoids height:auto jank). */
const slideUpTransition = {
  type: "tween" as const,
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1] as const,
};

interface AnalysisHistoryListProps {
  examId: string;
  refreshKey: number;
  subjects: ExamSubjectDto[];
  onChanged: () => void;
}

export function AnalysisHistoryList({
  examId,
  refreshKey,
  subjects,
  onChanged,
}: AnalysisHistoryListProps) {
  const t = useTranslations("analysis.history");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof fetchMockExamsList>>["items"]
  >([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
    setExpandedId(null);
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

  function toggleExpanded(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  if (loading) {
    return <HistoryListSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-start gap-3 px-1 py-2">
        <p className="text-sm" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
        <Button type="button" variant="secondary" onClick={() => void loadFirstPage()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="px-1 py-2 text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("empty")}
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-0.5" data-testid="analysis-history-list">
        {items.map((item) => {
          const expanded = expandedId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => toggleExpanded(item.id)}
                aria-expanded={expanded}
                aria-controls={`analysis-history-panel-${item.id}`}
                className={[
                  "grid min-h-10 w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-[10px] px-2.5 py-2 text-left",
                  "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none",
                  expanded
                    ? "bg-black/[0.06]"
                    : "hover:bg-black/[0.05]",
                ].join(" ")}
              >
                <span className="min-w-0">
                  <span
                    className="block truncate text-sm font-semibold"
                    style={{
                      color: "var(--color-main)",
                      fontFamily: "var(--font-heading)",
                    }}
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
                  className="text-right text-sm font-bold tabular-nums"
                  style={{
                    color: "var(--color-main)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  {t("net", { net: item.totalNet })}
                </span>
                <ChevronDown
                  className="size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none"
                  style={{
                    color: "var(--color-secondary)",
                    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                  strokeWidth={2.25}
                  aria-hidden
                />
              </button>

              <div
                className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                style={{
                  gridTemplateRows: expanded ? "1fr" : "0fr",
                }}
              >
                <div className="min-h-0 overflow-hidden">
                  <AnimatePresence initial={false}>
                    {expanded ? (
                      <motion.div
                        key={`panel-${item.id}`}
                        initial={
                          reduceMotion ? false : { y: 18, opacity: 0 }
                        }
                        animate={{ y: 0, opacity: 1 }}
                        exit={
                          reduceMotion
                            ? undefined
                            : { y: 10, opacity: 0 }
                        }
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : slideUpTransition
                        }
                      >
                        <AnalysisHistoryDetail
                          mockExamId={item.id}
                          subjects={subjects}
                          variant="accordion"
                          onClose={() => setExpandedId(null)}
                          onChanged={onChanged}
                        />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {items.length < total ? (
        <div className="mt-2 flex flex-col items-start gap-2 px-1 pt-1">
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
    </>
  );
}

function HistoryListSkeleton() {
  const t = useTranslations("analysis.history");

  return (
    <SkeletonGroup label={t("loading")} className="block">
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: PAGE_SIZE }, (_, index) => (
          <div
            key={index}
            className="grid min-h-10 grid-cols-[minmax(0,1fr)_4rem_1rem] items-center gap-2 rounded-[10px] px-2.5 py-2"
            style={skeletonStaggerStyle(index)}
          >
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28 rounded-[var(--radius-card)]" />
              <Skeleton className="h-3 w-16 rounded-[var(--radius-card)]" />
            </div>
            <Skeleton className="h-4 w-14 rounded-[var(--radius-card)]" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
        ))}
      </div>
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
