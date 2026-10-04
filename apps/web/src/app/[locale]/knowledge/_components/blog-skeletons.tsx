import { useTranslations } from "next-intl";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { PANEL_CARD } from "@/components/panel/panel-styles";

const BONE = "rounded-[var(--radius-card)]";

/**
 * The list's own shape (featured card + rows) while the section streams. The stagger delay is written
 * inline: `skeletonStaggerStyle` lives in a client module and cannot be called on the server.
 */
export function PostsSkeleton() {
  const t = useTranslations("knowledge");
  return (
    <SkeletonGroup label={t("loading")} className="flex flex-col gap-5">
      <div className={`${PANEL_CARD} flex flex-col gap-4 sm:flex-row sm:gap-6`}>
        <Skeleton className={`aspect-video w-full sm:aspect-4/3 sm:w-5/12 sm:max-w-80 ${BONE}`} />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className={`h-3.5 w-28 ${BONE}`} />
          <Skeleton className={`h-6 w-4/5 ${BONE}`} />
          <Skeleton className={`h-3.5 w-full ${BONE}`} />
          <Skeleton className={`h-3.5 w-2/3 ${BONE}`} />
        </div>
      </div>
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-1 shadow-[var(--shadow-card)]">
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="flex items-center gap-4 border-t border-[var(--color-border)] py-4 first:border-t-0"
            style={{ animationDelay: `${row * 60}ms` }}
          >
            <Skeleton className={`size-18 shrink-0 sm:h-18 sm:w-24 ${BONE}`} />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className={`h-3 w-32 ${BONE}`} />
              <Skeleton className={`h-4 w-3/4 ${BONE}`} />
              <Skeleton className={`h-3 w-full ${BONE}`} />
            </div>
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}

export function ExamDaySkeleton() {
  const t = useTranslations("knowledge");
  return (
    <SkeletonGroup label={t("loading")} className={`${PANEL_CARD} flex flex-col gap-3`}>
      <Skeleton className={`h-4 w-24 ${BONE}`} />
      <Skeleton className={`h-6 w-44 ${BONE}`} />
      <Skeleton className="h-8 w-40 rounded-full" />
      <Skeleton className={`h-3.5 w-full ${BONE}`} />
    </SkeletonGroup>
  );
}
