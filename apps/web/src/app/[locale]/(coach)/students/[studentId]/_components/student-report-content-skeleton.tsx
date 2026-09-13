"use client";

import { useTranslations } from "next-intl";
import { Skeleton, SkeletonGroup } from "@mentor/ui";

const BLOCK = "rounded-[var(--radius-card)]";

/** The report's shape while it loads: header, the status column, and the rail on wide screens. */
export function StudentReportContentSkeleton() {
  const t = useTranslations("mentorship");
  return (
    <SkeletonGroup label={t("loading")} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className={`h-6 w-32 ${BLOCK}`} />
        <Skeleton className={`h-9 w-64 max-w-full ${BLOCK}`} />
        <Skeleton className={`h-5 w-80 max-w-full ${BLOCK}`} />
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-7">
          <Skeleton className={`h-28 w-full ${BLOCK}`} />
          <Skeleton className={`h-36 w-full ${BLOCK}`} />
          <Skeleton className={`h-40 w-full ${BLOCK}`} />
          <Skeleton className={`h-56 w-full ${BLOCK}`} />
        </div>
        <div className="hidden flex-col gap-4 xl:flex">
          <Skeleton className={`h-56 w-full ${BLOCK}`} />
          <Skeleton className={`h-48 w-full ${BLOCK}`} />
          <Skeleton className={`h-12 w-full ${BLOCK}`} />
        </div>
      </div>
    </SkeletonGroup>
  );
}
