"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import type { ExamSubjectDto } from "@mentor/types";
import { Skeleton, SkeletonGroup, skeletonStaggerStyle } from "@mentor/ui";
import { FormError } from "@/components/form";
import {
  PANEL_CARD,
  PANEL_CARD_TITLE,
  PANEL_TEXT_LINK,
} from "@/components/panel/panel-styles";
import { fetchMockExamsList } from "@/lib/mock-exams";
import { AnalysisHistoryDetail } from "./analysis-history-detail";
import { formatTrendDate } from "./analysis-types";
import { errorMessage } from "./use-analysis-data";

const PAGE_SIZE = 5;
const ROW_DIVIDER = "border-t border-[color-mix(in_srgb,var(--color-main)_7%,transparent)]";

/** Slide-up content; the container height uses CSS grid (avoids height:auto jank). */
const slideUpTransition = {
  type: "tween" as const,
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1] as const,
};

/**
 * "Geçmiş denemeler": the rail card (below the views on narrower screens). A row opens in place to
 * the exam's subjects; editing and deleting sit behind the row's menu.
 */
export function AnalysisHistoryCard({
  examId,
  refreshKey,
  subjects,
  onChanged,
}: {
  examId: string;
  refreshKey: number;
  subjects: ExamSubjectDto[];
  onChanged: () => void;
}) {
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
    setError(null);
    setMoreError(null);
    setExpandedId(null);
    try {
      const response = await fetchMockExamsList(1, PAGE_SIZE, examId);
      setItems(response.items);
      setPage(1);
      setTotal(response.total);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    // Deliberate fetch trigger after mount and after every save, edit or delete.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFirstPage();
  }, [loadFirstPage, refreshKey]);

  const loadMore = useCallback(async () => {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const response = await fetchMockExamsList(page + 1, PAGE_SIZE, examId);
      setItems((current) => [...current, ...response.items]);
      setPage(response.page);
      setTotal(response.total);
    } catch {
      setMoreError(t("load_more_error"));
    } finally {
      setLoadingMore(false);
    }
  }, [examId, items.length, loadingMore, page, t, total]);

  return (
    <section
      className={`${PANEL_CARD} flex flex-col`}
      aria-labelledby="analysis-history-title"
      data-testid="analysis-history-card"
    >
      <div className="flex items-baseline justify-between gap-3 pb-3">
        <h2 id="analysis-history-title" className={PANEL_CARD_TITLE}>
          {t("title")}
        </h2>
        {total > 0 ? (
          <span className="text-caption font-bold tabular-nums text-[var(--color-secondary)]">
            {t("count", { count: total })}
          </span>
        ) : null}
      </div>

      {loading ? (
        <HistorySkeleton />
      ) : error ? (
        <div className="flex flex-col items-start gap-1">
          <FormError message={error} />
          <button type="button" onClick={() => void loadFirstPage()} className={PANEL_TEXT_LINK}>
            {t("retry")}
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-caption text-[var(--color-secondary)]">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col" data-testid="analysis-history-list">
          {items.map((item) => {
            const expanded = expandedId === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                  aria-expanded={expanded}
                  aria-controls={`analysis-history-panel-${item.id}`}
                  className={`flex min-h-14 w-full cursor-pointer items-center gap-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${ROW_DIVIDER}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold text-[var(--color-main)]">
                      {item.publisherName || t("publisher_fallback")}
                    </span>
                    <span className="block text-caption text-[var(--color-secondary)]">
                      {formatTrendDate(item.takenAt, locale)}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="text-body-sm font-extrabold tabular-nums text-[var(--color-main)]"
                  >
                    {item.totalNet}
                  </span>
                  <span className="sr-only">{t("net", { net: item.totalNet })}</span>
                  <ChevronDown
                    className={`size-[18px] shrink-0 text-[var(--color-secondary)] transition-transform duration-200 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                </button>
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                  style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
                >
                  <div className="min-h-0 overflow-hidden">
                    <AnimatePresence initial={false}>
                      {expanded ? (
                        <motion.div
                          key={`panel-${item.id}`}
                          initial={reduceMotion ? false : { y: 18, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={reduceMotion ? undefined : { y: 10, opacity: 0 }}
                          transition={reduceMotion ? { duration: 0 } : slideUpTransition}
                        >
                          <AnalysisHistoryDetail
                            mockExamId={item.id}
                            subjects={subjects}
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
      )}

      {!loading && !error && items.length < total ? (
        <div className="flex flex-col items-start pt-1">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            aria-busy={loadingMore || undefined}
            className={`${PANEL_TEXT_LINK} disabled:opacity-60`}
          >
            {t("load_more")}
          </button>
          {moreError ? (
            <p role="alert" className="text-caption text-[var(--color-secondary)]">
              {moreError}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function HistorySkeleton() {
  const t = useTranslations("analysis.history");

  return (
    <SkeletonGroup label={t("loading")} className="block">
      <div className="flex flex-col">
        {Array.from({ length: PAGE_SIZE }, (_, index) => (
          <div
            key={index}
            className={`flex min-h-14 items-center gap-3 py-2 ${ROW_DIVIDER}`}
            style={skeletonStaggerStyle(index)}
          >
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-28 rounded-[var(--radius-card)]" />
              <Skeleton className="h-3 w-16 rounded-[var(--radius-card)]" />
            </div>
            <Skeleton className="h-4 w-12 rounded-[var(--radius-card)]" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}
