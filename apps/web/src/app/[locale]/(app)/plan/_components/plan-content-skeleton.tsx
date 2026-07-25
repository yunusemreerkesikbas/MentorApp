"use client";

import { Card, Skeleton, SkeletonGroup, skeletonStaggerStyle } from "@mentor/ui";
import { useTranslations } from "next-intl";

const LIST_ROW_COUNT = 4;
const TIMELINE_DAY_COUNT = 4;

function PlanTaskRowSkeleton({ index }: { index: number }) {
  return (
    <div
      className="flex min-h-[56px] items-center gap-2 border-b border-white/30 py-2 last:border-b-0"
      style={skeletonStaggerStyle(index)}
    >
      <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-[68%] rounded-[var(--radius-card)]" />
        <Skeleton className="h-3.5 w-[28%] rounded-[var(--radius-card)]" />
      </div>
      <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
    </div>
  );
}

/** Liste / Hafta görev listesi iskeleti. */
export function PlanListSkeleton() {
  const t = useTranslations("plan");

  return (
    <Card>
      <Skeleton className="mb-3 h-5 w-24 rounded-[var(--radius-card)]" />
      <SkeletonGroup label={t("loading")} className="flex flex-col">
        {Array.from({ length: LIST_ROW_COUNT }, (_, index) => (
          <PlanTaskRowSkeleton key={index} index={index} />
        ))}
      </SkeletonGroup>
    </Card>
  );
}

/** Timeline — 3–4 day blocks on a vertical rail. */
export function PlanTimelineSkeleton() {
  const t = useTranslations("plan");

  return (
    <Card className="relative overflow-hidden">
      <SkeletonGroup
        label={t("loading")}
        className="mentor-plan-timeline-scroll relative flex flex-col gap-6"
      >
        <div
          className="absolute bottom-2 left-[11px] top-2 w-0.5"
          style={{ backgroundColor: "var(--color-progress-track)" }}
          aria-hidden
        />
        {Array.from({ length: TIMELINE_DAY_COUNT }, (_, dayIndex) => (
          <div key={dayIndex} className="relative pl-14">
            <Skeleton
              className="absolute top-1 h-6 w-6 -translate-x-1/2 rounded-full"
              style={{ left: 24, ...skeletonStaggerStyle(dayIndex) }}
            />
            <Skeleton
              className="mb-2 h-4 w-36 rounded-[var(--radius-card)]"
              style={skeletonStaggerStyle(dayIndex)}
            />
            <div className="flex flex-col">
              {Array.from({ length: dayIndex === 0 ? 2 : 1 }, (_, rowIndex) => (
                <PlanTaskRowSkeleton
                  key={rowIndex}
                  index={dayIndex * 2 + rowIndex + 1}
                />
              ))}
            </div>
          </div>
        ))}
      </SkeletonGroup>
    </Card>
  );
}

/** Mobile Hafta — nav card + task card skeletons. */
export function PlanWeekSkeleton() {
  const t = useTranslations("plan");

  return (
    <div className="flex flex-col gap-5 lg:hidden">
      <Card>
        <SkeletonGroup label={t("loading")} className="flex flex-col gap-3">
          <Skeleton className="mx-auto h-4 w-40 rounded-[var(--radius-card)]" />
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, index) => (
              <Skeleton
                key={index}
                className="h-[52px] rounded-[var(--radius-card)]"
                style={skeletonStaggerStyle(index)}
              />
            ))}
          </div>
          <Skeleton className="mx-auto h-3 w-48 rounded-[var(--radius-card)]" />
        </SkeletonGroup>
      </Card>
      <PlanListSkeleton />
    </div>
  );
}

/** Desktop Hafta skeleton — simplified two-column blocks. */
export function PlanWeekDesktopSkeleton() {
  const t = useTranslations("plan");

  return (
    <div className="hidden lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6">
      <SkeletonGroup label={t("loading")} className="flex flex-col gap-4">
        <Skeleton className="h-[320px] rounded-[var(--radius-card)]" />
        <Skeleton className="h-[280px] rounded-[var(--radius-card)]" />
      </SkeletonGroup>
      <Skeleton className="min-h-[400px] rounded-[var(--radius-card)]" />
    </div>
  );
}
