import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { PostListSkeleton } from "./post-skeleton";

export function TabContentSkeleton({
  label,
  variant,
}: {
  label: string;
  variant: "feed" | "trends";
}) {
  if (variant === "trends") {
    return (
      <SkeletonGroup label={label} className="divide-y divide-[#e7e9ee]">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="space-y-2 px-4 py-4">
            <Skeleton className="h-3 w-28 rounded-full" />
            <Skeleton className="h-5 w-44 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
        ))}
      </SkeletonGroup>
    );
  }

  return (
    <div>
      <SkeletonGroup label={label} className="border-b border-[#e7e9ee]">
      <div className="space-y-3 px-4 py-4">
        <Skeleton className="h-5 w-40 rounded-full" />
        <Skeleton className="h-16 w-full rounded-[var(--radius-card)]" />
      </div>
      </SkeletonGroup>
      <PostListSkeleton label={label} count={3} />
    </div>
  );
}
