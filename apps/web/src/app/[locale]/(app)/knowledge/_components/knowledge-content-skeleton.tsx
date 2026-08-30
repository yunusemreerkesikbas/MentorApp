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
  KNOWLEDGE_FEATURED_ASPECT_CLASS,
  KNOWLEDGE_SPLIT_CLASS,
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
            <Skeleton className="aspect-[2/1] w-full rounded-[var(--radius-card)]" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <Card key={index} style={skeletonStaggerStyle(index)}>
                  <Skeleton className="aspect-[4/3] w-full" />
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
