"use client";

import { Card, Skeleton, SkeletonGroup, skeletonStaggerStyle } from "@mentor/ui";
import { useTranslations } from "next-intl";
import { PlanCalendarSkeleton } from "./plan-content-skeleton";

export function CoachPlanSkeleton() {
  const t = useTranslations("coachPlan");

  return (
    <main className="flex w-full flex-col gap-3 px-2 py-4 lg:h-dvh lg:px-6 lg:py-4">
      <SkeletonGroup label={t("loading")} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-48 rounded-[var(--radius-card)]" />
            <Skeleton className="h-4 w-72 max-w-full rounded-[var(--radius-card)]" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-11 w-32 rounded-[var(--radius-card)]" />
            <Skeleton className="h-11 w-36 rounded-[var(--radius-card)]" />
          </div>
        </div>
        <Card className="flex gap-2 overflow-hidden lg:hidden">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton
              key={index}
              className="h-11 w-28 shrink-0 rounded-[var(--radius-card)]"
              style={skeletonStaggerStyle(index)}
            />
          ))}
        </Card>
      </SkeletonGroup>
      <PlanCalendarSkeleton />
    </main>
  );
}
