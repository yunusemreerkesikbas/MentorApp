"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import X from "lucide-react/dist/esm/icons/x.mjs";
import type { MockExamDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Card, SectionHeading } from "@mentor/ui";
import { FormError } from "@/components/form";
import { fetchMockExamById } from "@/lib/analiz";
import { formatTrendDate } from "./analiz-types";

interface AnalizHistoryDetailProps {
  mockExamId: string | null;
  onClose: () => void;
}

export function AnalizHistoryDetail({ mockExamId, onClose }: AnalizHistoryDetailProps) {
  const t = useTranslations("analysis.history");
  const locale = useLocale();
  const [detail, setDetail] = useState<MockExamDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = mockExamId != null;

  useEffect(() => {
    if (!mockExamId) {
      setDetail(null);
      setError(null);
      return;
    }
    let active = true;
    setDetail(null);
    setError(null);
    fetchMockExamById(mockExamId)
      .then((dto) => {
        if (active) setDetail(dto);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err),
        );
      });
    return () => {
      active = false;
    };
  }, [mockExamId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[29] bg-black/30 motion-reduce:transition-none"
        style={{ top: "3.5rem" }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed bottom-0 right-0 z-30 flex w-full max-w-md flex-col overflow-hidden sm:rounded-tl-[var(--radius-card)]"
        style={{
          top: "3.5rem",
          background: "var(--color-bg, white)",
          boxShadow: "var(--shadow-card)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="analiz-history-title"
      >
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{ borderColor: "color-mix(in srgb, var(--color-main) 8%, transparent)" }}
        >
          <h2
            id="analiz-history-title"
            className="text-base font-bold"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {t("detail_title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-secondary)" }}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <FormError message={error} />
          {detail ? (
            <Card className="flex flex-col gap-4">
              <div>
                <p
                  className="text-xl font-bold tabular-nums"
                  style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
                >
                  {detail.totalNet}
                </p>
                <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
                  {detail.examName} · {formatTrendDate(detail.takenAt, locale)}
                </p>
              </div>
              <ul className="flex flex-col gap-2">
                {detail.subjects.map((s) => (
                  <li
                    key={s.subjectRef}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span style={{ color: "var(--color-body)" }}>{s.subjectName}</span>
                    <span className="tabular-nums" style={{ color: "var(--color-secondary)" }}>
                      D{s.correct} Y{s.wrong} B{s.blank} · {s.net}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : !error ? (
            <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
              …
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
