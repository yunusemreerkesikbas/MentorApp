"use client";

import { Skeleton, SkeletonGroup, skeletonStaggerStyle } from "@mentor/ui";
import { useTranslations } from "next-intl";
import { COVER_RATIO } from "@/components/notebook/notebook-surface";
import { MOBILE_BELOW_APP_CHROME_HEIGHT_CLASS } from "@/lib/app-shell";
import { COVER_MAX_WIDTH_PX } from "./notebook-shell-layout";

/**
 * Loading layout for the notebook — the cover the shell opens on, not the open spread.
 *
 * Mobile (`max-sm`, same cut as `MOBILE_QUERY`): due strip above the leaf, pager in the gap
 * above the tab bar. Desktop: those sit on the book. Pen/Kaydet belong to an open spread and
 * are omitted so they do not vanish when the cover arrives.
 */
function PagerPlaceholder() {
  return (
    <div className="flex items-center justify-center gap-2">
      <Skeleton
        className="size-11 rounded-full"
        style={skeletonStaggerStyle(3)}
      />
      <Skeleton
        className="h-7 w-16 rounded-full"
        style={skeletonStaggerStyle(4)}
      />
      <Skeleton
        className="size-11 rounded-full"
        style={skeletonStaggerStyle(5)}
      />
    </div>
  );
}

/**
 * Loading layout for the notebook — the cover the shell opens on, not the open spread.
 *
 * Mobile (`max-sm`, same cut as `MOBILE_QUERY`): due strip above the leaf, pager in the gap
 * above the tab bar. Desktop: those sit on the book. Pen/Kaydet belong to an open spread and
 * are omitted so they do not vanish when the cover arrives.
 */
export function NotebookContentSkeleton() {
  const t = useTranslations("notebook");

  return (
    <SkeletonGroup
      label={t("loading")}
      className={`flex flex-col gap-2 overflow-hidden p-2 ${MOBILE_BELOW_APP_CHROME_HEIGHT_CLASS}`}
    >
      <div className="flex shrink-0 sm:hidden">
        <Skeleton
          className="h-9 w-48 max-w-full rounded-full"
          style={skeletonStaggerStyle(0)}
        />
      </div>

      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
        <div
          className="relative w-full max-h-full"
          style={{
            aspectRatio: COVER_RATIO,
            maxWidth: COVER_MAX_WIDTH_PX,
            maxHeight: "100%",
          }}
        >
          <Skeleton
            className="absolute inset-0 rounded-[var(--radius-card)]"
            style={skeletonStaggerStyle(1)}
          />
          <Skeleton
            className="absolute top-2 left-2 hidden h-9 w-44 rounded-full sm:block"
            style={skeletonStaggerStyle(2)}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-2 hidden sm:flex">
            <PagerPlaceholder />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 justify-center sm:hidden">
        <PagerPlaceholder />
      </div>
    </SkeletonGroup>
  );
}
