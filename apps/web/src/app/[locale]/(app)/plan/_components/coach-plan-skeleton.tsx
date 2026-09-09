"use client";

import { Card, Skeleton, SkeletonGroup, skeletonStaggerStyle } from "@mentor/ui";
import { useTranslations } from "next-intl";

export function CoachPlanSkeleton() {
  const t = useTranslations("coachPlan");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-6 sm:px-8 lg:py-10">
      <SkeletonGroup label={t("loading")} className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-48 rounded-[var(--radius-card)]" />
            <Skeleton className="h-4 w-72 max-w-full rounded-[var(--radius-card)]" />
          </div>
          <Skeleton className="h-11 w-44 rounded-[var(--radius-card)]" />
        </div>
        <Card className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton
              key={index}
              className="h-11 w-32 shrink-0 rounded-[var(--radius-card)]"
              style={skeletonStaggerStyle(index)}
            />
          ))}
        </Card>
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-11 w-11 rounded-[var(--radius-card)]" />
          <Skeleton className="h-6 w-48 rounded-[var(--radius-card)]" />
          <Skeleton className="h-11 w-11 rounded-[var(--radius-card)]" />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton
              key={index}
              className="h-40 rounded-[var(--radius-card)]"
              style={skeletonStaggerStyle(index)}
            />
          ))}
        </div>
      </SkeletonGroup>
    </main>
  );
}
