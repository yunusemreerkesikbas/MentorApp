import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { PANEL_GRID_CLASS, PANEL_MAIN_CLASS } from "@/components/panel/panel-styles";

/** Mirrors the room frame (header card with tabs, then the list) so the swap moves nothing. */
export function ZoneShellSkeleton({ label = "Yükleniyor…" }: { label?: string }) {
  return (
    <div className={PANEL_MAIN_CLASS}>
      <SkeletonGroup label={label} className={PANEL_GRID_CLASS}>
        <div className="flex min-w-0 flex-col gap-5">
          <Skeleton className="h-48 w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-96 w-full rounded-[var(--radius-card)]" />
        </div>
        <div className="hidden flex-col gap-5 xl:flex">
          <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-56 w-full rounded-[var(--radius-card)]" />
        </div>
      </SkeletonGroup>
    </div>
  );
}
