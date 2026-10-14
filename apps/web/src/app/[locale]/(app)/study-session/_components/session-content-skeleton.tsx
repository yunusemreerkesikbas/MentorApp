"use client";

import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { useTranslations } from "next-intl";
import {
  SESSION_CENTER_CLASS,
  SESSION_GRID_CLASS,
  SESSION_MAIN_CLASS,
  SESSION_RAIL_CLASS,
} from "./session-idle-view";
import { SESSION_CARD_CLASS } from "./session-today-card";

/**
 * Idle /seans placeholder in the same frame as the page (centre axis + rail), so
 * the swap moves nothing.
 */
export function SessionContentSkeleton() {
  const t = useTranslations("session");

  return (
    <main className="w-full" aria-busy>
      <SkeletonGroup label={t("loading")} className={SESSION_MAIN_CLASS}>
        <div className={SESSION_GRID_CLASS}>
          <div className={SESSION_CENTER_CLASS}>
            <div className="flex justify-center gap-2">
              <Skeleton className="h-11 w-28 rounded-full" />
              <Skeleton className="h-11 w-32 rounded-full" />
              <Skeleton className="h-11 w-11 rounded-full sm:w-28" />
            </div>
            <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 xl:pt-2">
              <Skeleton className="size-[280px] rounded-full" />
              <div className="flex gap-3">
                <Skeleton className="size-11 rounded-full" />
                <Skeleton className="size-11 rounded-full" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-11 w-24 rounded-full" />
                <Skeleton className="h-11 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-56 rounded-[var(--radius-card)]" />
              <Skeleton className="h-14 w-full rounded-[var(--play-radius)]" />
            </div>
          </div>
          <div className={SESSION_RAIL_CLASS} aria-hidden>
            {[0, 1, 2].map((card) => (
              <div key={card} className={SESSION_CARD_CLASS}>
                <Skeleton className="h-5 w-28 rounded-[var(--radius-card)]" />
                <Skeleton className="h-8 w-32 rounded-[var(--radius-card)]" />
                <Skeleton className="h-3 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </SkeletonGroup>
    </main>
  );
}
