"use client";

import { Card, Skeleton, SkeletonGroup, skeletonStaggerStyle } from "@mentor/ui";
import { useTranslations } from "next-intl";
import { PlanCalendarSkeleton } from "./plan-content-skeleton";

export function CoachPlanSkeleton() {
  const t = useTranslations("coachPlan");

  return (
    <main className="flex w-full flex-col gap-3 px-2 py-4 lg:h-dvh lg:px-6 lg:py-4">
      <SkeletonGroup label={t("loading")} className="flex flex-col gap-4">
        <div className="flex items-center">
          <Skeleton className="size-11 rounded-[var(--radius-card)]" />
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
