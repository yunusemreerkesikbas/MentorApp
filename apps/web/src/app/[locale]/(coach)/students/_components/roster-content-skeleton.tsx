import { Skeleton } from "@mentor/ui";

/**
 * The roster's own loading shape (frontend.md § Loading skeletons): header band, invite card, then
 * three student rows — the layout the page settles into, not a spinner standing in for it.
 */
export function RosterContentSkeleton() {
  return (
    <>
      <Skeleton className="h-28 w-full rounded-[var(--radius-card)]" />
      <Skeleton className="h-28 w-full rounded-[var(--radius-card)]" />
      <Skeleton className="h-28 w-full rounded-[var(--radius-card)]" />
    </>
  );
}
