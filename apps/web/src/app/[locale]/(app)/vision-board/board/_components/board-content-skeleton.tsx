"use client";

import { Skeleton, SkeletonGroup, skeletonStaggerStyle } from "@mentor/ui";
import { VISION_BOARD_CANVAS } from "@mentor/types";
import { useTranslations } from "next-intl";

/**
 * Loading layout for the board editor — icon rail, detail panel, toolbar and canvas in their
 * final positions so nothing jumps when the document arrives.
 */
export function BoardContentSkeleton() {
  const t = useTranslations("vision.board");

  return (
    <SkeletonGroup
      label={t("loading")}
      className="flex h-dvh flex-col lg:flex-row"
    >
      <div className="flex gap-1 px-2 py-2 lg:w-16 lg:flex-col lg:px-1 lg:pb-3 lg:pt-3">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton
            key={index}
            className="h-11 w-14 rounded-[var(--radius-card)] lg:w-full"
            style={skeletonStaggerStyle(index)}
          />
        ))}
      </div>
      <div className="hidden w-64 shrink-0 flex-col gap-3 p-3 lg:flex">
        <Skeleton className="h-11 w-full rounded-[var(--radius-card)]" style={skeletonStaggerStyle(1)} />
        <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" style={skeletonStaggerStyle(2)} />
        <Skeleton className="h-16 w-full rounded-[var(--radius-card)]" style={skeletonStaggerStyle(3)} />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <Skeleton
          className="h-11 w-full rounded-full"
          style={skeletonStaggerStyle(1)}
        />
        <Skeleton
          className="w-full rounded-[var(--radius-card)]"
          style={{
            ...skeletonStaggerStyle(2),
            aspectRatio: `${VISION_BOARD_CANVAS.width} / ${VISION_BOARD_CANVAS.height}`,
          }}
        />
      </div>
    </SkeletonGroup>
  );
}
