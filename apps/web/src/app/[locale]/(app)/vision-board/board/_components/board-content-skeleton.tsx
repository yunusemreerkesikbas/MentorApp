"use client";

import { Skeleton, SkeletonGroup, skeletonStaggerStyle } from "@mentor/ui";
import { VISION_BOARD_CANVAS } from "@mentor/types";
import { useTranslations } from "next-intl";

/**
 * Loading layout for the board editor — rail, toolbar and canvas in their final positions so
 * nothing jumps when the document arrives. Shimmer and enter motion come from the shared
 * primitives; only the arrangement is page-specific (frontend standards § Loading skeletons).
 */
export function BoardContentSkeleton() {
  const t = useTranslations("vision.board");

  return (
    <SkeletonGroup
      label={t("loading")}
      className="flex min-h-[70vh] flex-col gap-4 lg:flex-row"
    >
      <div className="flex gap-2 lg:w-44 lg:flex-col">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton
            key={index}
            className="h-11 flex-1 rounded-[var(--radius-card)] lg:flex-none"
            style={skeletonStaggerStyle(index)}
          />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-3">
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
