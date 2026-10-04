"use client";

import { useTranslations } from "next-intl";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { PANEL_GRID_CLASS, PANEL_MAIN_CLASS } from "@/components/panel/panel-styles";

/**
 * While auth settles the app shell renders `/dashboard` early (like `/plan`), and only this may
 * paint then: everything else needs the providers that mount after auth.
 */
export function DashboardContentSkeleton() {
  const t = useTranslations("panel");

  return (
    <main className={PANEL_MAIN_CLASS}>
      <SkeletonGroup label={t("loading")} className={PANEL_GRID_CLASS}>
        <div className="flex min-w-0 flex-col gap-5">
          <div className="hidden gap-2 lg:grid">
            <Skeleton className="h-8 w-64 rounded-[var(--radius-card)]" />
            <Skeleton className="h-4 w-36 rounded-[var(--radius-card)]" />
          </div>
          <Skeleton className="h-14 rounded-[var(--play-radius)]" />
          <TodayPathSkeleton />
        </div>
        <div className="hidden flex-col gap-5 xl:flex">
          <Skeleton className="h-36 rounded-[var(--radius-card)]" />
          <Skeleton className="h-64 rounded-[var(--radius-card)]" />
          <Skeleton className="h-56 rounded-[var(--radius-card)]" />
        </div>
      </SkeletonGroup>
    </main>
  );
}

/** The hero's placeholder, also shown in place while `/coaching/today` is in flight. */
export function TodayPathSkeleton() {
  return (
    <div
      className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)] sm:p-7"
      aria-hidden
    >
      <div className="flex items-start gap-4">
        <Skeleton className="size-16 shrink-0 rounded-full sm:size-20" />
        <Skeleton className="h-16 flex-1 rounded-[var(--radius-card)]" />
      </div>
      <Skeleton className="h-6 w-3/4 rounded-[var(--radius-card)]" />
      <div className="flex flex-col gap-3 py-4">
        <Skeleton className="h-5 w-2/3 rounded-[var(--radius-card)]" />
        <div className="flex justify-between gap-3 py-2">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="size-12 rounded-full sm:size-14" />
          ))}
        </div>
        <Skeleton className="h-5 w-1/2 rounded-[var(--radius-card)]" />
      </div>
      <Skeleton className="h-14 w-full rounded-[var(--play-radius)] sm:w-72" />
      <Skeleton className="ml-auto h-5 w-24 rounded-[var(--radius-card)]" />
      <div className="-mx-5 -mb-5 border-t border-[var(--color-border)] px-5 py-5 sm:-mx-7 sm:-mb-7 sm:px-7">
        <div className="flex gap-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-10 flex-1 rounded-[var(--radius-card)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
