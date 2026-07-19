"use client";

import { useTranslations } from "next-intl";
import {
  Card,
  Skeleton,
  SkeletonGroup,
  skeletonStaggerStyle,
} from "@mentor/ui";

export function KnowledgeContentSkeleton() {
  const t = useTranslations("knowledge");

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
      <SkeletonGroup label={t("loading")} className="flex flex-col gap-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-full max-w-xl" />
        </div>

        <Card>
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
        </Card>

        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          {[0, 1, 2].map((index) => (
            <Card key={index} style={skeletonStaggerStyle(index)}>
              <div className="space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-32" />
              </div>
            </Card>
          ))}
        </div>
      </SkeletonGroup>
    </main>
  );
}
