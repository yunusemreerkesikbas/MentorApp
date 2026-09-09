"use client";
import { useLocale, useTranslations } from "next-intl";
import type { NotebookReviewHistoryItem, Paginated } from "@mentor/types";
import { ChevronLeft, ChevronRight, Clock3 } from "lucide-react";

import { Link } from "@/i18n/navigation";

import styles from "./analysis-review-progress.module.css";

export function AnalysisReviewHistory({
  history,
  reviewQuery,
  page,
  onPageChange,
}: {
  history: Paginated<NotebookReviewHistoryItem>;
  reviewQuery: Record<string, string>;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("analysis.review");
  const locale = useLocale();
  return (
    <section
      className={styles.history}
      aria-labelledby="review-history-heading"
    >
      <h2 id="review-history-heading" className="text-xl font-semibold">
        {t("history")}
      </h2>
      <p className={styles.historyNote}>{t("historyNote")}</p>
      {history.items.length === 0 ? (
        <p className={styles.empty}>{t("empty")}</p>
      ) : (
        <ul className={styles.historyList}>
          {history.items.map((item) => {
            const nextReview = item.nextReviewAt
              ? new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeZone: "Europe/Istanbul",
                }).format(new Date(item.nextReviewAt))
              : null;
            return (
              <li key={item.id} className={styles.historyItem}>
                <Link
                  className={styles.historyLink}
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
                <p className={styles.reviewSchedule}>
                  <Clock3 size={15} aria-hidden />
                  {nextReview
                    ? t("next", { date: nextReview })
                    : t("noNext")}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <div className={styles.pagination}>
        <button
          type="button"
          className={styles.paginationButton}
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={18} aria-hidden />
          {t("previous")}
        </button>
        <button
          type="button"
          className={`${styles.paginationButton} ${styles.paginationNext}`}
          disabled={page * history.pageSize >= history.total}
          onClick={() => onPageChange(page + 1)}
        >
          {t("more")}
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>
    </section>
  );
}
