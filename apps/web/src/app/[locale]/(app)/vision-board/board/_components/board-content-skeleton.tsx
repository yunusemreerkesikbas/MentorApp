"use client";

import { Skeleton, SkeletonGroup, skeletonStaggerStyle } from "@mentor/ui";
import { VISION_BOARD_CANVAS } from "@mentor/types";
import { useTranslations } from "next-intl";
import { NOTEBOOK_TRAY_RADIUS_CLASS } from "../../../notebook/_components/notebook-shell-layout";

const RAIL_SLOTS = [0, 1, 2, 3, 4];

/**
 * Loading layout for the board editor: the wall, the top bar's discs, the rail (a dock on a
 * phone), the open panel from `lg` and the board, each where the editor puts it, so nothing jumps
 * when the document arrives. The chrome is drawn as its own surfaces: a skeleton block is the
 * wall's colour and would vanish on it.
 */
export function BoardContentSkeleton() {
  const t = useTranslations("vision.board");

  return (
    <SkeletonGroup
      label={t("loading")}
      className="relative flex h-dvh flex-col overflow-hidden bg-[var(--color-surface-container)]"
    >
      <div className="flex shrink-0 items-center gap-1.5 px-3 pt-2 lg:pe-4 lg:ps-[1.375rem] lg:pt-3">
        <div className="size-11 rounded-full bg-[var(--color-surface)]" />
        <span className="flex-1" />
        <div className="h-11 w-36 rounded-full bg-[var(--color-surface)]" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2 max-lg:pt-2 lg:pb-3 lg:pe-4 lg:ps-[26.5rem]">
        {/* The contextual toolbar's row, empty until something is selected. */}
        <div className="min-h-[52px] shrink-0 max-lg:order-last" />
        <div
          className="mx-auto w-full rounded-[var(--radius-card)] bg-[var(--color-surface)] p-3"
          style={{ maxWidth: "calc((100dvh - 12rem) * 1.5)" }}
        >
          <Skeleton
            className="w-full rounded-[var(--radius-card)]"
            style={{
              ...skeletonStaggerStyle(2),
              aspectRatio: `${VISION_BOARD_CANVAS.width} / ${VISION_BOARD_CANVAS.height}`,
            }}
          />
        </div>
      </div>

      <div className="absolute bottom-2 left-[5.5rem] top-2 hidden w-80 flex-col gap-3 rounded-[var(--radius-card)] bg-[var(--color-surface)] p-4 lg:flex">
        <Skeleton className="h-6 w-24 rounded-full" style={skeletonStaggerStyle(1)} />
        <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" style={skeletonStaggerStyle(2)} />
        <Skeleton className="h-36 w-full rounded-[var(--radius-card)]" style={skeletonStaggerStyle(3)} />
      </div>

      <div
        className={`mx-3 mb-[calc(0.75rem+env(safe-area-inset-bottom))] flex shrink-0 gap-0.5 bg-[var(--color-surface)] px-2 py-1 lg:absolute lg:left-2 lg:top-1/2 lg:m-0 lg:w-[4.5rem] lg:-translate-y-1/2 lg:flex-col lg:gap-1 lg:px-1 lg:py-3 ${NOTEBOOK_TRAY_RADIUS_CLASS}`}
      >
        {RAIL_SLOTS.map((index) => (
          <div key={index} className="flex min-h-11 flex-1 items-center justify-center lg:flex-none lg:py-2">
            <Skeleton className="size-8 rounded-[var(--radius-card)]" style={skeletonStaggerStyle(index)} />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}
