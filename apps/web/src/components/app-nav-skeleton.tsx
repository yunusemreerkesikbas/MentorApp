"use client";

import { useTranslations } from "next-intl";
import { Logo, Skeleton, SkeletonGroup } from "@mentor/ui";

/** Matches the profile area without hiding the usable navigation chrome. */
export function AppNavIdentitySkeleton({ mobile = false }: { mobile?: boolean }) {
  const t = useTranslations("panel");
  return (
    <SkeletonGroup label={t("loading")} data-testid="app-nav-identity-skeleton"
      className={mobile ? "flex min-w-0 flex-1 items-center gap-3" : "mb-5 grid gap-3"}>
      <Skeleton className={`${mobile ? "size-10" : "size-14"} shrink-0 rounded-full`} />
      <div className="grid gap-2">
        <Skeleton className="h-5 w-36 rounded-[var(--radius-card)]" />
        <Skeleton className="h-4 w-24 rounded-[var(--radius-card)]" />
      </div>
    </SkeletonGroup>
  );
}

/** Auth-time chrome uses the sidebar's CSS width and the same mobile header/tab footprint. */
export function AppNavSkeleton() {
  const t = useTranslations("panel");
  return <>
    <aside className="mentor-app-sidebar fixed inset-y-0 left-0 z-20 hidden flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:flex"
      data-testid="app-nav-skeleton">
      <div className="mentor-app-sidebar-expanded p-5">
      <div className="mb-4 flex min-h-11 items-center text-2xl"><Logo /></div>
      <AppNavIdentitySkeleton />
      <SkeletonGroup label={t("loading")} className="mt-2 grid gap-1">
        {[0, 1, 2, 3, 4, 5].map((row) => <div key={row} className="flex min-h-11 items-center gap-3 px-3">
          <Skeleton className="size-5 shrink-0 rounded-[var(--radius-card)]" />
          <Skeleton className="h-4 w-24 rounded-[var(--radius-card)]" />
        </div>)}
      </SkeletonGroup>
      </div>
      <div className="mentor-app-sidebar-collapsed absolute inset-x-0 top-5 grid justify-items-center gap-6" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map(row => <Skeleton key={row} className="size-5 rounded-[var(--radius-card)]" />)}
      </div>
    </aside>
    <header className="fixed inset-x-0 top-0 z-20 flex h-16 items-center border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 lg:hidden">
      <AppNavIdentitySkeleton mobile />
    </header>
    <div className="fixed inset-x-5 bottom-5 z-20 rounded-full bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)] lg:hidden">
      <SkeletonGroup label={t("loading")} className="flex justify-around">
        {[0, 1, 2, 3, 4].map(row => <Skeleton key={row} className="size-8 rounded-full" />)}
      </SkeletonGroup>
    </div>
  </>;
}
