"use client";

import { useTranslations } from "next-intl";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { NOTEBOOK_PAGE_CANVAS } from "@mentor/types";

/** Page-specific loading layout: the strip, the closed book, the pager. */
export function NotebookContentSkeleton() {
  const t = useTranslations("notebook");
  return (
    <SkeletonGroup label={t("loading")} className="flex flex-col gap-4">
      <Skeleton className="h-12 w-full rounded-[var(--radius-card)]" />
      <div
        className="mx-auto w-full max-w-md"
        style={{
          aspectRatio: `${NOTEBOOK_PAGE_CANVAS.width} / ${NOTEBOOK_PAGE_CANVAS.height}`,
        }}
      >
        <Skeleton className="h-full w-full rounded-[var(--radius-card)]" />
      </div>
      <div className="flex items-center justify-center gap-3">
        <Skeleton className="h-9 w-24 rounded-[var(--radius-card)]" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-9 w-24 rounded-[var(--radius-card)]" />
      </div>
    </SkeletonGroup>
  );
}
