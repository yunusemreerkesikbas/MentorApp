import { Skeleton, SkeletonGroup } from "@mentor/ui";

export function ZoneShellSkeleton({ label = "Yükleniyor…" }: { label?: string }) {
  return (
    <SkeletonGroup label={label} className="mx-auto grid max-w-[924px] items-start gap-6 xl:grid-cols-[600px_300px]">
        <div className="bg-[var(--color-surface)] sm:my-6 sm:border-x sm:border-[var(--color-border)]">
        <Skeleton className="aspect-[3/1] w-full" />
        <div className="space-y-3 px-4 py-4">
          <Skeleton className="h-8 w-56 rounded-[var(--radius-card)]" />
          <Skeleton className="h-7 w-24 rounded-[var(--radius-card)]" />
          <Skeleton className="h-7 w-36 rounded-[var(--radius-card)]" />
        </div>
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-24 w-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full" />
        ))}
        </div>
        <div className="hidden space-y-4 pt-6 xl:block">
          <Skeleton className="h-12 w-full rounded-t-2xl" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
    </SkeletonGroup>
  );
}
