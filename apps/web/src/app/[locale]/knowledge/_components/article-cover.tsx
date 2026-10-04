import { BookOpen, CalendarClock, ClipboardList, type LucideIcon } from "lucide-react";
import type { InfoArticleSummaryDto } from "@mentor/types";

const WELLS: Record<string, { fill: string; Icon: LucideIcon }> = {
  APPLICATION: { fill: "bg-[var(--play-well-blue)]", Icon: ClipboardList },
  EXAM_PROCESS: { fill: "bg-[var(--play-well-peri)]", Icon: CalendarClock },
  GENERAL: { fill: "bg-[var(--play-well-violet)]", Icon: BookOpen },
};

/** The editor's cover, or the category's well + icon when there is none (never an empty grey box). */
export function ArticleCover({
  article,
  className,
  iconClassName = "size-11",
  priority = false,
}: {
  article: InfoArticleSummaryDto;
  className: string;
  iconClassName?: string;
  priority?: boolean;
}) {
  if (article.coverImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- editorial image with known dimensions
      <img
        src={article.coverImage.url}
        alt={article.coverImage.alt}
        width={article.coverImage.width}
        height={article.coverImage.height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        className={`shrink-0 rounded-[var(--radius-card)] object-cover ${className}`}
      />
    );
  }
  const { fill, Icon } = WELLS[article.category] ?? WELLS.GENERAL!;
  return (
    <div
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-[var(--radius-card)] text-[var(--play-selected-ink)] ${fill} ${className}`}
    >
      <Icon className={iconClassName} strokeWidth={1.75} />
    </div>
  );
}
