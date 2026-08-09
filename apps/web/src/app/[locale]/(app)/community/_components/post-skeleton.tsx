import { Skeleton, SkeletonGroup } from "@mentor/ui";

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
          ? "w-full overflow-hidden rounded-[var(--radius-card)] border border-[#e7e9ee] bg-white divide-y divide-[#e7e9ee]"
          : "w-full divide-y divide-[#e7e9ee]"
      }
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={
            variant === "card"
              ? "flex w-full gap-3 bg-white px-4 py-5"
              : "flex gap-3 bg-white px-4 py-4"
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

export function PostDetailSkeleton({ label }: { label: string }) {
  return (
    <main className="mx-auto min-w-0 max-w-[600px] bg-white sm:my-6 sm:border-x sm:border-[#e7e9ee]">
      <PostListSkeleton label={label} count={1} />
      <div className="border-y border-[#e7e9ee] px-4 py-4">
        <SkeletonGroup label={label} className="space-y-3">
          <Skeleton className="h-16 w-full rounded-[var(--radius-card)]" />
          <Skeleton className="ml-auto h-10 w-24 rounded-[var(--radius-card)]" />
        </SkeletonGroup>
      </div>
      <PostListSkeleton label={label} count={2} />
    </main>
  );
}
