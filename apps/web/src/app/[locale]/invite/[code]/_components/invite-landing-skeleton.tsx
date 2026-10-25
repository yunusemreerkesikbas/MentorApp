"use client";

import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { useTranslations } from "next-intl";

/**
 * Mirrors the welcome card (`RoomNoticeCard`): Puhu over the top edge, the title, one body line,
 * the discount pill, the code row, the disclosure and the two actions. The frame around it
 * belongs to the shell, so the swap to the real card moves nothing.
 */
export function InviteLandingSkeleton() {
  const t = useTranslations("invite_landing");
  return (
    <SkeletonGroup
      label={t("loading")}
      className="relative mx-auto mt-20 flex w-full max-w-[26rem] flex-col items-center gap-2.5 rounded-[var(--play-radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 pb-6 pt-14 shadow-[var(--shadow-card)]"
    >
      <Skeleton className="absolute -top-16 left-1/2 size-28 -translate-x-1/2 rounded-full" />
      <Skeleton className="h-7 w-64 max-w-full rounded-[var(--radius-card)]" />
      <Skeleton className="h-4 w-56 max-w-full rounded-[var(--radius-card)]" />
      <div className="mt-3 flex w-full flex-col items-center gap-3">
        {/* The discount pill wraps to two lines on a phone and sits on one from ~30rem up. */}
        <Skeleton className="h-[4.25rem] w-full rounded-[var(--radius-card)] min-[30rem]:h-11 min-[30rem]:w-72" />
        <div className="flex flex-col items-center gap-1.5">
          <Skeleton className="h-4 w-20 rounded-[var(--radius-card)]" />
          <Skeleton className="h-8 w-44 rounded-full" />
        </div>
        <div className="flex w-full flex-col items-center gap-1.5">
          <Skeleton className="h-3.5 w-64 max-w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-3.5 w-40 max-w-full rounded-[var(--radius-card)] min-[30rem]:hidden" />
        </div>
        <Skeleton className="mt-2 h-14 w-full rounded-[var(--play-radius)]" />
        <Skeleton className="h-11 w-36 rounded-[var(--radius-card)]" />
      </div>
    </SkeletonGroup>
  );
}
