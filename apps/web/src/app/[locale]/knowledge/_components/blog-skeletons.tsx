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
      {/* Most posts have no cover: the category glyph's 40 px slot leads the text. */}
      <div className={`${PANEL_CARD} flex items-start gap-4`}>
        <Skeleton className={`size-10 shrink-0 ${BONE}`} />
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
            <Skeleton className={`size-10 shrink-0 ${BONE}`} />
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
      <Skeleton className={`h-4 w-40 ${BONE}`} />
      <Skeleton className={`h-3.5 w-full ${BONE}`} />
    </SkeletonGroup>
  );
}
