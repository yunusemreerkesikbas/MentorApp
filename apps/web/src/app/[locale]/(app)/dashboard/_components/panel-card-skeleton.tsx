"use client";

import { useTranslations } from "next-intl";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { PANEL_CARD } from "@/components/panel/panel-styles";

/** Card-shaped placeholders shared by auth and independently resolving panel feeds. */
export function PanelCardSkeleton({
  kind,
}: {
  kind: "membership" | "community" | "quests" | "countdown" | "vision" | "journey" | "coach";
}) {
  const t = useTranslations("panel");
  return (
    <SkeletonGroup label={t("loading")} className={`${PANEL_CARD} flex flex-col gap-4`}
      data-testid={`panel-${kind}-skeleton`}>
      <Skeleton className="h-5 w-1/2 rounded-[var(--radius-card)]" />
      {kind === "vision" ? <Skeleton className="aspect-square w-full rounded-[var(--radius-card)]" /> :
        kind === "quests" ? <>
          {[0, 1, 2, 3].map((row) => <div key={row} className="grid gap-2">
            <Skeleton className="h-4 w-3/4 rounded-[var(--radius-card)]" />
            <Skeleton className="h-3 w-full rounded-full" />
          </div>)}
          <Skeleton className="h-16 rounded-[var(--radius-card)]" />
        </> : kind === "membership" || kind === "community" || kind === "coach" ? <>
          {Array.from({ length: kind === "coach" ? 1 : 2 }, (_, row) =>
            <div key={row} className="flex min-h-14 items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-[var(--radius-card)]" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-4 w-3/4 rounded-[var(--radius-card)]" />
                <Skeleton className="h-3 w-full rounded-[var(--radius-card)]" />
              </div>
            </div>)}
          {kind === "membership" ? <Skeleton className="my-3 h-4 w-1/2 rounded-[var(--radius-card)]" /> : null}
        </> : <>
          <Skeleton className={`${kind === "countdown" ? "h-8 w-1/3" : "h-3 w-full"} rounded-[var(--radius-card)]`} />
          <Skeleton className="h-4 w-3/4 rounded-[var(--radius-card)]" />
        </>}
    </SkeletonGroup>
  );
}
