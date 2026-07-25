"use client";

import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { useTranslations } from "next-intl";

/** Koç chat / landing loading layout — history header, content, composer. */
export function CoachChatSkeleton() {
  const t = useTranslations("coach");

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-2xl flex-col lg:min-h-screen">
      <div className="flex items-center gap-2 px-5 pt-6">
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="h-4 w-28 rounded-[var(--radius-card)]" />
      </div>

      <SkeletonGroup
        label={t("loading")}
        className="flex flex-1 flex-col items-center gap-4 px-5 py-6"
      >
        <Skeleton className="h-8 w-56 rounded-[var(--radius-card)]" />
        <Skeleton className="h-4 w-72 max-w-full rounded-[var(--radius-card)]" />
        <Skeleton className="my-4 size-48 rounded-[var(--radius-card)] sm:size-56" />
        <div className="flex flex-wrap justify-center gap-2">
          <Skeleton className="h-11 w-36 rounded-full" />
          <Skeleton className="h-11 w-40 rounded-full" />
          <Skeleton className="h-11 w-32 rounded-full" />
        </div>
      </SkeletonGroup>

      <div className="border-t border-white px-5 py-3">
        <Skeleton className="h-11 w-full rounded-[var(--radius-card)]" />
      </div>
    </main>
  );
}
