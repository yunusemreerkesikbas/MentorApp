"use client";

import { useTranslations } from "next-intl";
import {
  Card,
  Skeleton,
  SkeletonGroup,
  skeletonStaggerStyle,
} from "@mentor/ui";
import {
  KNOWLEDGE_ARTICLE_GRID_CLASS,
} from "./knowledge-layout";

export function KnowledgeContentSkeleton() {
  const t = useTranslations("knowledge");

  return (
    <main className="w-full px-5 py-8 lg:px-8 lg:py-10">
      <SkeletonGroup label={t("loading")} className="flex flex-col gap-6">
        <div className="flex gap-3">
          <Skeleton className="h-11 w-16" />
          <Skeleton className="h-11 w-16" />
          <Skeleton className="h-11 w-16" />
        </div>
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
          <div className="flex flex-col gap-6">
            {/* Featured hero card skeleton */}
            <div className="rounded-[var(--radius-card)] bg-[var(--color-surface-elevated)] p-4 shadow-[var(--shadow-card)] sm:p-5 lg:p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-center lg:gap-6">
                <Skeleton className="aspect-[16/10] w-full shrink-0 rounded-xl md:aspect-[4/3] md:w-[42%] lg:aspect-[16/10] lg:w-[45%]" />
                <div className="flex flex-1 flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-7 w-4/5" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                    <Skeleton className="h-9 w-9 rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            <div className={KNOWLEDGE_ARTICLE_GRID_CLASS}>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <Card key={index} style={skeletonStaggerStyle(index)}>
                  <Skeleton className="aspect-[16/10] w-full" />
                  <div className="mt-3 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </SkeletonGroup>
    </main>
  );
}
