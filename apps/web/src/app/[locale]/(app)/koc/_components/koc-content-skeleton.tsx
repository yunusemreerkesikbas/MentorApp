"use client";

import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { useTranslations } from "next-intl";

/** Koç hub loading layout — greeting, shortcut grid, CTA. */
export function KocHubSkeleton() {
  const t = useTranslations("coach");

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-2xl flex-col lg:min-h-screen">
      <div className="px-5 pt-8">
        <Skeleton className="h-7 w-40 rounded-[var(--radius-card)]" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full rounded-[var(--radius-card)]" />
      </div>

      <SkeletonGroup
        label={t("loading")}
        className="flex flex-1 flex-col gap-4 px-5 py-6"
      >
        <Skeleton className="h-8 w-56 rounded-[var(--radius-card)]" />
        <Skeleton className="h-4 w-72 max-w-full rounded-[var(--radius-card)]" />
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Skeleton className="h-[88px] rounded-[var(--radius-card)]" />
          <Skeleton className="h-[88px] rounded-[var(--radius-card)]" />
          <Skeleton className="h-[88px] rounded-[var(--radius-card)]" />
          <Skeleton className="h-[88px] rounded-[var(--radius-card)]" />
        </div>
        <Skeleton className="mt-auto h-11 w-full rounded-[var(--radius-card)]" />
      </SkeletonGroup>
    </main>
  );
}

/** Koç chat loading layout — back header, bubbles, composer. */
export function KocChatSkeleton() {
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
        <KocBubbleSkeleton align="left" className="w-3/5" />
        <KocBubbleSkeleton align="right" className="w-2/5" />
        <KocBubbleSkeleton align="left" className="w-1/2" />
      </SkeletonGroup>

      <div className="border-t border-white px-5 py-3">
        <Skeleton className="h-11 w-full rounded-[var(--radius-card)]" />
      </div>
    </main>
  );
}

function KocBubbleSkeleton({
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
