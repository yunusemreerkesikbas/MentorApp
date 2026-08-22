import { Card, Skeleton, SkeletonGroup, skeletonStaggerStyle } from "@mentor/ui";

const ROW_COUNT = 4;

/** Mirrors the subscription hero + definition-list card. */
export function SubscriptionContentSkeleton({ label }: { label: string }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 lg:px-8 lg:py-10">
      <SkeletonGroup label={label}>
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-6 w-40 rounded-[var(--radius-card)]" />
              <Skeleton className="h-8 w-28 rounded-[var(--radius-card)]" />
            </div>
            <Skeleton className="h-7 w-16 rounded-[var(--radius-card)]" />
          </div>
          <div className="mt-6 flex flex-col">
            {Array.from({ length: ROW_COUNT }, (_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-4 border-b py-3 last:border-b-0"
                style={{
                  ...skeletonStaggerStyle(index),
                  borderColor:
                    "color-mix(in srgb, var(--color-main) 8%, transparent)",
                }}
              >
                <Skeleton className="h-4 w-24 rounded-[var(--radius-card)]" />
                <Skeleton className="h-4 w-28 rounded-[var(--radius-card)]" />
              </div>
            ))}
          </div>
        </Card>
      </SkeletonGroup>
    </main>
  );
}
