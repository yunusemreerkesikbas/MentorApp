"use client";

import { Card, Skeleton, SkeletonGroup, skeletonStaggerStyle } from "@mentor/ui";
import { useTranslations } from "next-intl";

const FORM_ROWS = 4;
const HISTORY_ROWS = 5;

export function AnalysisContentSkeleton() {
  const t = useTranslations("analysis");

  return (
    <main className="flex w-full min-h-[calc(100dvh-4rem-80px-env(safe-area-inset-bottom))] lg:min-h-[calc(100dvh-4rem)]">
      <aside
        className="relative z-[1] hidden h-auto w-72 shrink-0 border-r bg-white/85 backdrop-blur-md lg:flex lg:flex-col"
        style={{
          borderColor: "color-mix(in srgb, var(--color-main) 8%, transparent)",
        }}
        aria-hidden
      >
        <div className="border-b px-4 py-4">
          <Skeleton className="h-5 w-36 rounded-[var(--radius-card)]" />
        </div>
        <div className="flex flex-col gap-0.5 p-3">
          {Array.from({ length: HISTORY_ROWS }, (_, index) => (
            <div
              key={index}
              className="grid min-h-10 grid-cols-[minmax(0,1fr)_4rem] items-center gap-2 rounded-[10px] px-2.5 py-2"
              style={skeletonStaggerStyle(index)}
            >
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-28 rounded-[var(--radius-card)]" />
                <Skeleton className="h-3 w-16 rounded-[var(--radius-card)]" />
              </div>
              <Skeleton className="h-4 w-14 rounded-[var(--radius-card)]" />
            </div>
          ))}
        </div>
      </aside>

      <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-4 lg:px-8 lg:py-8">
        <SkeletonGroup label={t("loading")} className="flex flex-col gap-6">
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-16 rounded-[var(--radius-card)]" />
                <Skeleton className="h-10 w-28 rounded-[var(--radius-card)]" />
                <Skeleton className="h-6 w-40 rounded-full" />
              </div>
              <Skeleton className="h-14 w-full max-w-[220px] rounded-[var(--radius-card)] sm:h-14" />
              <Skeleton className="h-11 w-36 rounded-[var(--radius-card)]" />
            </div>
          </Card>

          <div className="flex gap-1 rounded-full border border-white/40 p-1">
            {[0, 1, 2].map((i) => (
              <Skeleton
                key={i}
                className="h-10 flex-1 rounded-full"
                style={skeletonStaggerStyle(i)}
              />
            ))}
          </div>

          <Card>
            <Skeleton className="mb-4 h-6 w-40 rounded-[var(--radius-card)]" />
            <div className="hidden sm:grid sm:grid-cols-[1fr_repeat(3,4rem)] sm:gap-2 sm:pb-2">
              <Skeleton className="h-4 w-20 rounded-[var(--radius-card)]" />
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-4 rounded-[var(--radius-card)]" />
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {Array.from({ length: FORM_ROWS }, (_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_repeat(3,4rem)] sm:items-center"
                  style={skeletonStaggerStyle(index + 3)}
                >
                  <Skeleton className="h-5 w-28 rounded-[var(--radius-card)]" />
                  {[0, 1, 2].map((c) => (
                    <Skeleton key={c} className="h-12 rounded-[var(--radius-card)]" />
                  ))}
                </div>
              ))}
            </div>
            <Skeleton className="mt-4 h-14 w-full rounded-[var(--radius-card)]" />
          </Card>
        </SkeletonGroup>
      </div>
    </main>
  );
}
