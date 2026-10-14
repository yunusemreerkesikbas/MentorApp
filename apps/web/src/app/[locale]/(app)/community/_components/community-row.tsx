import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/i18n/navigation";

/**
 * DESIGN.md §6.1 list row: a bare 40 px glyph slot (no well), a two-line title and one meta line;
 * the whole row is the link. Rows sit in a `divide-y` list, so a row draws no border of its own.
 */
export function CommunityRow({
  href,
  icon,
  eyebrow,
  title,
  meta,
  trailing,
}: {
  href: ComponentProps<typeof Link>["href"];
  icon: ReactNode;
  eyebrow?: string;
  title: string;
  meta: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]"
    >
      <span className="grid size-10 shrink-0 place-items-center text-[var(--color-secondary)]" aria-hidden>
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {eyebrow ? (
          <span className="text-xs font-extrabold text-[var(--color-secondary)]">{eyebrow}</span>
        ) : null}
        <span className="line-clamp-2 text-body-sm font-extrabold leading-snug text-[var(--color-main)]">
          {title}
        </span>
        <span className="truncate text-caption font-semibold text-[var(--color-secondary)]">{meta}</span>
      </span>
      {trailing}
    </Link>
  );
}

/** The list a card's rows sit in: hairlines between rows, none above the first. */
export const COMMUNITY_ROW_LIST = "flex flex-col divide-y divide-[var(--color-border)]";

/** A community text field: white with a hairline, never a gray fill (canvas revision, 2026-10-07). */
export const COMMUNITY_FIELD =
  "min-h-12 w-full rounded-[var(--radius-card)] border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-body-sm font-semibold text-[var(--color-main)] outline-none placeholder:text-[var(--color-secondary)] focus-visible:border-[var(--play-selected-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";

/** A card whose rows carry their own padding (lists, the room header): PANEL_CARD without p-5,
 *  since appending p-0 to PANEL_CARD loses to p-5 in the generated CSS order. */
export const COMMUNITY_CARD_FLUSH =
  "overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";
