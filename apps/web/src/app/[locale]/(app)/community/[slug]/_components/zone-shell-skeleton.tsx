import { Skeleton, SkeletonGroup } from "@mentor/ui";

export function ZoneShellSkeleton({ label = "Yükleniyor…" }: { label?: string }) {
  return (
    <div className="px-5 py-8 lg:px-6 lg:py-10">
      <SkeletonGroup label={label}>
        {/* Header */}
        <Skeleton className="mb-2 h-8 w-48 rounded-lg" />
        <Skeleton className="mb-6 h-5 w-20 rounded-full" />
        {/* Composer */}
        <Skeleton className="mb-6 h-20 w-full rounded-[var(--radius-card)]" />
        {/* Thread cards */}
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="mb-4 h-28 w-full rounded-[var(--radius-card)]" />
        ))}
      </SkeletonGroup>
    </div>
  );
}
