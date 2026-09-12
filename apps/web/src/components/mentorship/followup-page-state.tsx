"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button, Skeleton, SkeletonGroup } from "@mentor/ui";

export function FollowupPageState({ loading, error, retry, children }: {
  loading: boolean; error: string | null; retry: () => void; children: ReactNode;
}) {
  const t = useTranslations("mentorship");
  if (loading) return <SkeletonGroup label={t("followup_loading")}><Skeleton className="h-24 w-full" /></SkeletonGroup>;
  if (error) return <div role="alert" className="flex flex-col items-start gap-3"><p>{error}</p><Button variant="secondary" onClick={retry}>{t("followup_retry")}</Button></div>;
  return children;
}

export function FollowupPagination({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (page: number) => void;
}) {
  const t = useTranslations("mentorship");
  if (total <= pageSize) return null;
  return <nav aria-label={t("followup_pages")} className="mt-4 flex items-center gap-3">
    <Button variant="secondary" disabled={page === 1} onClick={() => onChange(page - 1)}>{t("followup_previous")}</Button>
    <span>{t("followup_page", { page })}</span>
    <Button variant="secondary" disabled={page * pageSize >= total} onClick={() => onChange(page + 1)}>{t("followup_next")}</Button>
  </nav>;
}
