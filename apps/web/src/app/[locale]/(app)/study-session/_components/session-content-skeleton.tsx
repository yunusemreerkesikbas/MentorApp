"use client";

import { Card, Skeleton, SkeletonGroup, skeletonStaggerStyle } from "@mentor/ui";
import { useTranslations } from "next-intl";

const HISTORY_ROWS = 5;

/**
 * Idle /seans layout placeholder — left history rail, centered timer, right goal/buddy.
 */
export function SessionContentSkeleton() {
  const t = useTranslations("session");

  return (
    <main
      className="flex w-full min-h-[calc(100dvh-4rem-80px-env(safe-area-inset-bottom))] lg:min-h-[calc(100dvh-4rem)]"
      aria-busy
    >
      <aside
        className="relative z-[1] hidden h-auto w-72 shrink-0 border-r bg-[color-mix(in_srgb,var(--color-surface)_85%,transparent)] backdrop-blur-md lg:flex lg:flex-col"
        style={{
          borderColor: "color-mix(in srgb, var(--color-main) 8%, transparent)",
        }}
        aria-hidden
      >
        <div className="border-b px-4 py-4">
          <Skeleton className="h-5 w-32 rounded-[var(--radius-card)]" />
        </div>
        <div className="flex flex-col gap-0.5 p-3">
          {Array.from({ length: HISTORY_ROWS }, (_, index) => (
            <div
              key={index}
              className="grid min-h-10 grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-2 px-2.5 py-2"
              style={skeletonStaggerStyle(index)}
            >
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-24 rounded-[var(--radius-card)]" />
                <Skeleton className="h-3 w-16 rounded-[var(--radius-card)]" />
              </div>
              <Skeleton className="h-3 w-12 justify-self-end rounded-[var(--radius-card)]" />
            </div>
          ))}
        </div>
      </aside>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 py-8">
        <SkeletonGroup label={t("loading")} className="flex w-full flex-col items-center gap-5">
          <div className="flex w-full items-center justify-between gap-3">
            <Skeleton className="h-11 w-28 rounded-full" />
            <Skeleton className="h-11 w-36 rounded-full" />
          </div>
          <Skeleton className="size-[280px] rounded-full" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
          </div>
          <Skeleton className="h-12 w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-12 w-full rounded-[var(--radius-card)]" />
        </SkeletonGroup>
      </div>

      <aside
        className="hidden w-72 shrink-0 flex-col gap-4 border-l p-4 lg:flex"
        style={{
          borderColor: "color-mix(in srgb, var(--color-main) 8%, transparent)",
        }}
        aria-hidden
      >
        <Card className="flex flex-col gap-3 px-5 py-4">
          <Skeleton className="h-3 w-28 rounded-[var(--radius-card)]" />
          <Skeleton className="h-5 w-24 rounded-[var(--radius-card)]" />
          <Skeleton className="h-2 w-full rounded-full" />
        </Card>
        <Card className="flex flex-col gap-3 px-5 py-4">
          <Skeleton className="h-3 w-24 rounded-[var(--radius-card)]" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 flex-1 rounded-[var(--radius-card)]" />
          </div>
        </Card>
      </aside>
    </main>
  );
}
