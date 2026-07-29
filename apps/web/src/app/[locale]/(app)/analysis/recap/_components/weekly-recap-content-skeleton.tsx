"use client";

import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { useTranslations } from "next-intl";

export function WeeklyRecapContentSkeleton() {
  const t = useTranslations("analysis.recap");

  return (
    <div className="weekly-recap-theme grid min-h-dvh place-items-center bg-[var(--recap-ink)] p-0 md:p-4">
      <SkeletonGroup label={t("loading")}>
        <div className="relative h-dvh w-dvw overflow-hidden bg-[var(--recap-coral)] md:h-[calc(100dvh-2rem)] md:w-auto md:aspect-[9/16] md:rounded-[var(--radius-card)]">
          <div className="absolute inset-x-0 top-3 flex gap-1 px-3">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
              <Skeleton key={index} className="h-1 flex-1 rounded-full" />
            ))}
          </div>
          <div className="flex h-full flex-col items-center justify-center gap-6 px-8">
            <Skeleton className="size-48 rounded-full" />
            <Skeleton className="h-16 w-full max-w-xs rounded-[var(--radius-card)]" />
            <Skeleton className="h-6 w-48 rounded-[var(--radius-card)]" />
          </div>
        </div>
      </SkeletonGroup>
    </div>
  );
}
