"use client";

import { useTranslations } from "next-intl";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { SPREAD_RATIO } from "@/components/notebook/notebook-surface";

/**
 * The notebook's loading layout — the shell's own frame with the content greyed out.
 *
 * It used to be a generic column: a strip, a portrait card at `max-w-md`, a pager. Every one of
 * those was the wrong shape. The book that arrives is a *spread*, half again as wide as it is tall,
 * not a single portrait page; it fills the column rather than sitting in a 448px box; and the rail
 * and side panel beside it were missing entirely, so the whole page shifted sideways the moment the
 * real thing rendered. A skeleton that reserves the wrong space is worse than none: it promises a
 * layout and then breaks the promise.
 *
 * So the frame here mirrors `NotebookShell` exactly — same outer padding, same fixed viewport height
 * on desktop, same rail width, same panel width, and the book's box derived from `SPREAD_RATIO`
 * rather than a guess. What lands on top of it lands in the same place.
 */
export function NotebookContentSkeleton() {
  const t = useTranslations("notebook");

  return (
    <SkeletonGroup
      label={t("loading")}
      className="flex min-h-[100dvh] flex-col gap-3 px-1 pb-4 pt-2 sm:px-2 sm:pb-6 sm:pt-3 lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden lg:pb-8 lg:pt-3"
    >
      {/* The due-review strip, which is the first thing the shell paints above the columns. */}
      <Skeleton className="h-11 w-56 shrink-0 rounded-full" />

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch">
        {/* The rail: a column of icon buttons on desktop, a horizontal strip on mobile. */}
        <div className="flex shrink-0 gap-2 lg:w-16 lg:flex-col">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton
              key={index}
              className="h-12 w-12 rounded-[var(--radius-card)] lg:w-full"
            />
          ))}
        </div>

        {/* The side panel. Hidden below `lg`, where it is a sheet rather than a column. */}
        <Skeleton className="hidden w-96 shrink-0 rounded-[var(--radius-card)] lg:block" />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-2 lg:py-[2vh]">
          {/* Undo / delete on the left, save on the right — the toolbar that rides above the book. */}
          <div className="flex w-full max-w-5xl items-center gap-2">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>

          {/* The spread. `min-h-0` and a ratio rather than a height: the same two constraints the
              real book is sized by, so it comes out the same size. */}
          <div className="flex min-h-0 w-full flex-1 items-center justify-center">
            <Skeleton
              className="h-full w-full rounded-[var(--radius-card)]"
              style={{ aspectRatio: SPREAD_RATIO, maxWidth: "100%" }}
            />
          </div>
        </div>
      </div>
    </SkeletonGroup>
  );
}
