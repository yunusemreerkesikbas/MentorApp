import { Book2Icon } from "@solar-icons/react/linear/book-2";
import { CalendarMarkIcon } from "@solar-icons/react/linear/calendar-mark";
import { ClipboardListIcon } from "@solar-icons/react/linear/clipboard-list";
import type { InfoArticleSummaryDto } from "@mentor/types";
import { MediaImage } from "@/components/media-image";

const GLYPHS: Record<string, typeof Book2Icon> = {
  APPLICATION: ClipboardListIcon,
  EXAM_PROCESS: CalendarMarkIcon,
  GENERAL: Book2Icon,
};

/**
 * The editor's cover, or the category's bare Solar glyph in a 40 px slot when there is none: no
 * coloured well behind it (2026-10-14), the category label beside it carries the rest.
 */
export function ArticleCover({
  article,
  className,
  glyphSize = 22,
  priority = false,
}: {
  article: InfoArticleSummaryDto;
  /** Sizes the cover image; the glyph slot is always 40 px. */
  className: string;
  glyphSize?: number;
  priority?: boolean;
}) {
  if (article.coverImage) {
    return (
      <MediaImage
        privateMedia={false}
        retryable={false}
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
  const Glyph = GLYPHS[article.category] ?? Book2Icon;
  return (
    <span aria-hidden className="grid size-10 shrink-0 place-items-center text-[var(--color-secondary)]">
      <Glyph size={glyphSize} strokeWidth={1.75} />
    </span>
  );
}
