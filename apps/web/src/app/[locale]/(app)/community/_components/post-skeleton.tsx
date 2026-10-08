import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { PANEL_CARD, PANEL_GRID_CLASS, PANEL_MAIN_CLASS } from "@/components/panel/panel-styles";

export function PostListSkeleton({
  label,
  count = 3,
  variant = "row",
}: {
  label: string;
  count?: number;
  variant?: "row" | "card";
}) {
  return (
    <SkeletonGroup
      label={label}
      className={
        variant === "card"
          ? "w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]"
          : "w-full divide-y divide-[var(--color-border)]"
      }
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={
            variant === "card"
              ? "flex w-full gap-3 bg-[var(--color-surface)] px-4 py-5"
              : "flex gap-3 bg-[var(--color-surface)] px-4 py-4"
          }
        >
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28 rounded-full" />
              <Skeleton className="h-3 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-4 w-4/5 rounded-full" />
            {variant === "card" ? <Skeleton className="h-20 w-full rounded-[var(--radius-card)]" /> : null}
            <div className="flex justify-between pt-1">
              {Array.from({ length: 4 }).map((__, actionIndex) => (
                <Skeleton key={actionIndex} className="size-8 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </SkeletonGroup>
  );
}

/** Question, post and comment detail while loading: the crumb, the post card, the replies card and the rail. */
export function PostDetailSkeleton({ label }: { label: string }) {
  return (
    <main className={PANEL_MAIN_CLASS}>
      <SkeletonGroup label={label} className="flex flex-col gap-5">
        <Skeleton className="h-4 w-56 rounded-full" />
        <div className={PANEL_GRID_CLASS}>
          {/* Plain shapes, not PostListSkeleton: its own status region would nest inside this one. */}
          <div className="flex min-w-0 flex-col gap-5">
            <div className={`${PANEL_CARD} flex gap-3`}>
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <Skeleton className="h-4 w-40 rounded-full" />
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-4 w-4/5 rounded-full" />
              </div>
            </div>
            <div className={`${PANEL_CARD} flex flex-col gap-4`}>
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-16 w-full rounded-[var(--radius-card)]" />
              <Skeleton className="h-4 w-full rounded-full" />
              <Skeleton className="h-4 w-3/4 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-32 w-full rounded-[var(--radius-card)]" />
        </div>
      </SkeletonGroup>
    </main>
  );
}
