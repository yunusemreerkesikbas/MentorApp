"use client";

import { Card, SectionHeading, Skeleton, SkeletonGroup, skeletonStaggerStyle } from "@mentor/ui";
import { useTranslations } from "next-intl";

const LIST_ROW_COUNT = 4;
const TIMELINE_CARD_COUNT = 3;

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
      <SectionHeading>{t("tasks_title")}</SectionHeading>
      <SkeletonGroup label={t("loading")} className="mt-3 flex flex-col">
        {Array.from({ length: LIST_ROW_COUNT }, (_, index) => (
          <PlanTaskRowSkeleton key={index} index={index} />
        ))}
      </SkeletonGroup>
    </Card>
  );
}

/** Timeline görünümü iskeleti — sol eksen + kart satırları. */
export function PlanTimelineSkeleton() {
  const t = useTranslations("plan");

  return (
    <Card className="relative overflow-hidden">
      <SkeletonGroup label={t("loading")} className="relative flex min-h-[280px]">
        <div className="relative flex w-12 shrink-0 flex-col items-center">
          <div
            className="absolute bottom-0 top-0 w-0.5 -translate-x-1/2"
            style={{
              left: "50%",
              backgroundColor: "var(--color-progress-track)",
            }}
            aria-hidden
          />
          <Skeleton className="relative z-10 mt-1 h-11 w-11 rounded-full" />
        </div>

        <div className="min-w-0 flex-1 pl-3">
          <Skeleton
            className="mb-3 h-4 w-32 rounded-[var(--radius-card)]"
            style={skeletonStaggerStyle(0)}
          />
          <div className="flex flex-col gap-2">
            {Array.from({ length: TIMELINE_CARD_COUNT }, (_, index) => (
              <Skeleton
                key={index}
                className="h-[72px] w-full rounded-[var(--radius-card)]"
                style={skeletonStaggerStyle(index + 1)}
              />
            ))}
          </div>
          <Skeleton
            className="mb-3 mt-8 h-4 w-28 rounded-[var(--radius-card)]"
            style={skeletonStaggerStyle(TIMELINE_CARD_COUNT + 1)}
          />
          <Skeleton
            className="h-[64px] w-full rounded-[var(--radius-card)]"
            style={skeletonStaggerStyle(TIMELINE_CARD_COUNT + 2)}
          />
        </div>
      </SkeletonGroup>
    </Card>
  );
}

/** Hafta görünümü — seçili gün listesi. */
export function PlanWeekSkeleton() {
  return <PlanListSkeleton />;
}
