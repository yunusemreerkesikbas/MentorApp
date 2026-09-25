"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button, Skeleton, SkeletonGroup } from "@mentor/ui";
import { PANEL_LINK_BUTTON } from "./coach-ui";

export function FollowupPageState({
  loading,
  error,
  retry,
  children,
}: {
  loading: boolean;
  error: string | null;
  retry: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("mentorship");
  if (loading)
    return (
      <SkeletonGroup label={t("followup_loading")}>
        <Skeleton className="h-24 w-full" />
      </SkeletonGroup>
    );
  if (error)
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>{error}</p>
        <Button variant="secondary" onClick={retry}>
          {t("followup_retry")}
        </Button>
      </div>
    );
  return children;
}

export function FollowupPagination({
  page,
  total,
  pageSize,
  quiet = false,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  /** The coach's side panel: "Sayfa 1 / 2 · Sonraki" as text actions. The student card keeps its buttons. */
  quiet?: boolean;
  onChange: (page: number) => void;
}) {
  const t = useTranslations("mentorship");
  if (total <= pageSize) return null;
  if (quiet) {
    const pages = Math.ceil(total / pageSize);
    return (
      <nav aria-label={t("followup_pages")} className="flex items-center justify-center gap-5">
        {page > 1 ? (
          <button type="button" className={PANEL_LINK_BUTTON} onClick={() => onChange(page - 1)}>
            {t("followup_previous")}
          </button>
        ) : null}
        <span className="text-caption font-extrabold text-[var(--color-secondary)]">
          {t("followup_page_of", { page, pages })}
        </span>
        {page < pages ? (
          <button type="button" className={PANEL_LINK_BUTTON} onClick={() => onChange(page + 1)}>
            {t("followup_next")}
          </button>
        ) : null}
      </nav>
    );
  }
  return (
    <nav
      aria-label={t("followup_pages")}
      className="mt-4 flex items-center gap-3"
    >
      <Button
        variant="secondary"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        {t("followup_previous")}
      </Button>
      <span>{t("followup_page", { page })}</span>
      <Button
        variant="secondary"
        disabled={page * pageSize >= total}
        onClick={() => onChange(page + 1)}
      >
        {t("followup_next")}
      </Button>
    </nav>
  );
}
