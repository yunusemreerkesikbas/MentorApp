"use client";

import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { useTranslations } from "next-intl";

/** Koç hub loading layout — greeting, shortcut grid, CTA. */
export function CoachHubSkeleton() {
  const t = useTranslations("coach");

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-2xl flex-col px-5 py-6 lg:min-h-screen">
      <SkeletonGroup
        label={t("loading")}
        className="flex flex-1 flex-col gap-4"
      >
        <div className="flex flex-1 flex-col rounded-[var(--radius-card)] p-5 shadow-[var(--shadow-card)]">
          <Skeleton className="h-10 w-56 rounded-[var(--radius-card)]" />
          <Skeleton className="my-8 min-h-64 flex-1 rounded-[var(--radius-card)]" />
          <Skeleton className="mb-3 h-14 w-full rounded-[var(--radius-card)]" />
          <div className="mb-3 flex gap-2">
            <Skeleton className="h-11 w-32 rounded-full" />
            <Skeleton className="h-11 w-28 rounded-full" />
          </div>
          <Skeleton className="h-11 w-full rounded-[var(--radius-card)]" />
        </div>
      </SkeletonGroup>
    </main>
  );
}

/** Koç chat loading layout — back header, bubbles, composer. */
export function CoachChatSkeleton() {
  const t = useTranslations("coach");

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-2xl flex-col lg:min-h-screen">
      <div className="flex items-center gap-2 px-5 pt-6">
        <Skeleton className="size-11 rounded-[var(--radius-card)]" />
        <div className="flex-1">
          <Skeleton className="h-5 w-24 rounded-[var(--radius-card)]" />
          <Skeleton className="mt-1 h-3 w-40 rounded-[var(--radius-card)]" />
        </div>
      </div>

      <SkeletonGroup
        label={t("loading")}
        className="flex flex-1 flex-col gap-3 px-5 py-6"
      >
        <CoachBubbleSkeleton align="left" className="w-3/5" />
        <CoachBubbleSkeleton align="right" className="w-2/5" />
        <CoachBubbleSkeleton align="left" className="w-1/2" />
      </SkeletonGroup>

      <div className="border-t border-white px-5 py-3">
        <Skeleton className="h-11 w-full rounded-[var(--radius-card)]" />
      </div>
    </main>
  );
}

function CoachBubbleSkeleton({
  align,
  className,
}: {
  align: "left" | "right";
  className?: string;
}) {
  return (
    <div
      className={`flex ${align === "right" ? "justify-end" : "justify-start gap-2"}`}
    >
      {align === "left" ? (
        <Skeleton className="size-8 shrink-0 rounded-full" />
      ) : null}
      <Skeleton
        className={`h-12 rounded-[var(--radius-card)] ${className ?? ""}`}
      />
    </div>
  );
}
