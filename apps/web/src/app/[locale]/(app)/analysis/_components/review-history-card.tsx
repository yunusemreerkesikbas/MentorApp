"use client";

import { Check, ChevronRight, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { NotebookReviewHistoryItem, Paginated } from "@mentor/types";
import { http } from "@mentor/api-client";
import { Skeleton } from "@mentor/ui";
import {
  PANEL_CARD,
  PANEL_CARD_TITLE,
  PANEL_TEXT_LINK,
} from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";

const PAGE_SIZE = 5;
const DAYS = 30;
const ROW =
  "flex min-h-14 items-center gap-3 border-t border-[color-mix(in_srgb,var(--color-main)_7%,transparent)] py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";
const SOLVED_WELL =
  "bg-[color-mix(in_srgb,var(--color-success)_16%,var(--color-surface))] text-[var(--color-success)]";
const MISSED_WELL = "bg-[var(--play-track)] text-[var(--color-secondary)]";

/**
 * "Son tekrarların": the last reviews answered in the notebook, newest first, each opening its own
 * question. Moved here from Gelişim: it is evidence about mistakes, not about the net.
 */
export function ReviewHistoryCard({ examId }: { examId: string }) {
  const t = useTranslations("analysis.review");
  const tHistory = useTranslations("analysis.history");
  const locale = useLocale();
  const [pages, setPages] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    items: NotebookReviewHistoryItem[];
    total: number;
  } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const loadKey = `${examId}:${pages}:${attempt}`;

  useEffect(() => {
    let active = true;
    // One request for all shown pages keeps "Daha fazla göster" a plain page-size bump.
    const query = new URLSearchParams({
      examId,
      days: String(DAYS),
      page: "1",
      pageSize: String(PAGE_SIZE * pages),
    });
    http<Paginated<NotebookReviewHistoryItem>>(
      `/v1/coaching/notebook/review-history?${query.toString()}`,
    )
      .then((page) => {
        if (active) setResult({ key: loadKey, items: page.items, total: page.total });
      })
      .catch(() => {
        if (active) setFailedKey(loadKey);
      });
    return () => {
      active = false;
    };
  }, [examId, loadKey, pages]);

  const failed = failedKey === loadKey;
  const shown = result;
  const dateFormat = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Istanbul",
  });

  return (
    <section className={`${PANEL_CARD} flex flex-col`} aria-labelledby="analysis-reviews-title">
      <div className="flex items-baseline justify-between gap-3 pb-3">
        <h2 id="analysis-reviews-title" className={PANEL_CARD_TITLE}>
          {t("recent_title")}
        </h2>
        <span className="text-caption font-bold text-[var(--color-secondary)]">
          {t("recent_caption", { days: DAYS })}
        </span>
      </div>

      {failed ? (
        <div className="flex flex-col items-start gap-1">
          <p role="alert" className="text-caption text-[var(--color-secondary)]">
            {t("error")}
          </p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className={PANEL_TEXT_LINK}
          >
            {t("retry")}
          </button>
        </div>
      ) : !shown ? (
        <div className="flex flex-col gap-2" aria-busy aria-label={t("loading")}>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-12 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : shown.items.length === 0 ? (
        <p className="text-caption text-[var(--color-secondary)]">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col">
          {shown.items.map((item) => {
            const title =
              [item.subjectName, item.topicName].filter(Boolean).join(" · ") || t("unlabelled");
            const meta = [
              dateFormat.format(new Date(item.reviewedAt)),
              t(item.solved ? "solved" : "missed"),
              item.early ? t("early") : null,
              item.nextReviewAt
                ? t("next_short", { date: dateFormat.format(new Date(item.nextReviewAt)) })
                : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={item.id}>
                <Link
                  href={{
                    pathname: "/notebook",
                    query: {
                      review: "focus",
                      examId,
                      ...(item.subjectRef ? { subjectRef: item.subjectRef } : {}),
                      ...(item.topicRef ? { topicRef: item.topicRef } : {}),
                      entryId: item.entryId,
                    },
                  }}
                  className={ROW}
                >
                  <span
                    aria-hidden
                    className={`grid size-10 shrink-0 place-items-center rounded-[var(--radius-card)] ${item.solved ? SOLVED_WELL : MISSED_WELL}`}
                  >
                    {item.solved ? (
                      <Check className="size-5" strokeWidth={2.6} />
                    ) : (
                      <RotateCcw className="size-5" strokeWidth={2.2} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold text-[var(--color-main)]">
                      {title}
                    </span>
                    {/* The next review date matters more than one line: the meta wraps. */}
                    <span className="block text-caption text-[var(--color-secondary)]">
                      {meta}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-[18px] shrink-0 text-[var(--color-secondary)]"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {shown && !failed && shown.items.length < shown.total ? (
        <button
          type="button"
          onClick={() => setPages((value) => value + 1)}
          className={`${PANEL_TEXT_LINK} self-start pt-1`}
        >
          {tHistory("load_more")}
        </button>
      ) : null}
    </section>
  );
}
