"use client";

import { Card, Skeleton, SkeletonGroup, skeletonStaggerStyle } from "@mentor/ui";
import { useTranslations } from "next-intl";

const FORM_ROWS = 4;

export function AnalizContentSkeleton() {
  const t = useTranslations("analysis");

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 lg:px-8 lg:py-10">
      <SkeletonGroup label={t("loading")} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-48 rounded-[var(--radius-card)]" />
          <Skeleton className="h-5 w-full max-w-md rounded-[var(--radius-card)]" />
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-8 w-32 rounded-[var(--radius-card)]" />
            <Skeleton className="h-10 w-36 rounded-[var(--radius-card)]" />
          </div>
        </Card>

        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              className="h-11 flex-1 rounded-[var(--radius-card)]"
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
    </main>
  );
}
