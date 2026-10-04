"use client";

import { useTranslations } from "next-intl";
import { Skeleton, SkeletonGroup, skeletonStaggerStyle } from "@mentor/ui";
import { PANEL_CARD } from "@/components/panel/panel-styles";
import type { AnalysisTab } from "./analysis-types";

/**
 * The view's own placeholder while the analysis loads (DESIGN.md §10). The header paints at once and
 * the history card has its own, so nothing waits behind a page-level gate.
 */
export function AnalysisTabSkeleton({ tab }: { tab: AnalysisTab }) {
  const t = useTranslations("analysis");

  return (
    <SkeletonGroup label={t("loading")} className="flex flex-col gap-5">
      {tab === "entry" ? (
        <div className={`${PANEL_CARD} flex flex-col gap-4 sm:px-7 sm:py-6`}>
          <Skeleton className="h-7 w-48 rounded-[var(--radius-card)]" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-12 rounded-[var(--radius-card)]" />
            <Skeleton className="h-12 rounded-[var(--radius-card)]" />
          </div>
          {[0, 1, 2, 3].map((index) => (
            <Skeleton
              key={index}
              className="h-12 rounded-[var(--radius-card)]"
              style={skeletonStaggerStyle(index)}
            />
          ))}
          <Skeleton className="h-14 w-full self-end rounded-[var(--play-radius)] sm:w-48" />
        </div>
      ) : (
        <>
          <div className={`${PANEL_CARD} flex flex-col gap-5 sm:px-7 sm:py-6`}>
            <div className="flex items-start gap-4">
              <Skeleton className="size-16 shrink-0 rounded-full sm:size-20" />
              <Skeleton className="h-16 flex-1 rounded-[var(--play-radius)]" />
            </div>
            <Skeleton className="h-6 w-3/4 rounded-[var(--radius-card)]" />
            <div className="flex justify-between gap-3 py-4">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="size-12 rounded-full sm:size-14" />
              ))}
            </div>
            <Skeleton className="h-14 w-full rounded-[var(--play-radius)] sm:w-72" />
          </div>
          <div className={`${PANEL_CARD} flex flex-col gap-4`}>
            <Skeleton className="h-5 w-32 rounded-[var(--radius-card)]" />
            <Skeleton className="h-40 rounded-[var(--radius-card)]" />
          </div>
        </>
      )}
    </SkeletonGroup>
  );
}

/** Stand-in for the history card until the exam it belongs to is known. */
export function AnalysisHistorySkeleton() {
  return (
    <div className={`${PANEL_CARD} flex flex-col gap-3`} aria-hidden>
      <Skeleton className="h-5 w-40 rounded-[var(--radius-card)]" />
      {[0, 1, 2].map((index) => (
        <Skeleton
          key={index}
          className="h-12 rounded-[var(--radius-card)]"
          style={skeletonStaggerStyle(index)}
        />
      ))}
    </div>
  );
}
