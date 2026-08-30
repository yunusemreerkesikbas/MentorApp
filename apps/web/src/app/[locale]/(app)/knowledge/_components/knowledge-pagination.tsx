"use client";

import { useTranslations } from "next-intl";

export function KnowledgePagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("knowledge");
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label={t("pagination_label")}
      className="mt-6 flex items-center justify-center gap-3"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="min-h-11 cursor-pointer px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        {t("pagination_prev")}
      </button>
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("pagination_page", { page, pages: pageCount })}
      </p>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        className="min-h-11 cursor-pointer px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        {t("pagination_next")}
      </button>
    </nav>
  );
}
