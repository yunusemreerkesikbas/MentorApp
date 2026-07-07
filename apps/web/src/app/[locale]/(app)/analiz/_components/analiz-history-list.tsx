"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MockExamDto, MockExamTrendPointDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Card, SectionHeading } from "@mentor/ui";
import { fetchMockExamsList } from "@/lib/analiz";
import { formatTrendDate } from "./analiz-types";
import { AnalizHistoryDetail } from "./analiz-history-detail";

interface AnalizHistoryListProps {
  /** Bump to refetch after a new save. */
  refreshKey: number;
  onCopyLast: (exam: MockExamDto) => void;
}

export function AnalizHistoryList({ refreshKey, onCopyLast }: AnalizHistoryListProps) {
  const t = useTranslations("analysis.history");
  const tAnalysis = useTranslations("analysis");
  const locale = useLocale();
  const [items, setItems] = useState<MockExamTrendPointDto[]>([]);
  const [lastFull, setLastFull] = useState<MockExamDto | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchMockExamsList(1, 5);
      setItems(
        res.items.map((m) => ({
          id: m.id,
          takenAt: m.takenAt,
          totalNet: m.totalNet,
          examName: m.examName,
        })),
      );
      setLastFull(res.items[0] ?? null);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err),
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (error) {
    return (
      <p className="text-sm" style={{ color: "var(--color-danger, #b42318)" }}>
        {error}
      </p>
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
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className="min-h-[44px] cursor-pointer rounded-[var(--radius-card)] px-3 py-2 text-left text-sm transition-colors hover:bg-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
              style={{
                background: "color-mix(in srgb, var(--color-chip) 15%, white)",
                color: "var(--color-main)",
              }}
            >
              <span className="block font-bold tabular-nums">{item.totalNet}</span>
              <span className="block text-xs" style={{ color: "var(--color-secondary)" }}>
                {formatTrendDate(item.takenAt, locale)}
              </span>
            </button>
          ))}
        </div>
        {lastFull ? (
          <button
            type="button"
            onClick={() => onCopyLast(lastFull)}
            className="mt-4 min-h-[44px] text-sm font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-main)" }}
          >
            {tAnalysis("copy_last")}
          </button>
        ) : null}
      </Card>
      <AnalizHistoryDetail mockExamId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
