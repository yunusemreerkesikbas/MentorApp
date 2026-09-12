import { Skeleton } from "@mentor/ui";

/**
 * The roster's own loading shape (frontend.md § Loading skeletons): three student rows at the
 * height the redesigned card settles into — name row, a 2x2/4-up metric grid, and the action band
 * under its hairline. The layout the page settles into, not a spinner standing in for it.
 */
export function RosterContentSkeleton() {
  return (
    <>
      <Skeleton className="h-36 w-full rounded-[var(--radius-card)]" />
      <Skeleton className="h-36 w-full rounded-[var(--radius-card)]" />
      <Skeleton className="h-36 w-full rounded-[var(--radius-card)]" />
    </>
  );
}
