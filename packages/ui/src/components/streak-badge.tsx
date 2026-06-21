import { Card } from "./card.js";

export interface StreakBadgeProps {
  /** Pre-localized title — e.g. "5 günlük seri" or, at zero, "Serini bugün başlat". */
  title: string;
  /** Pre-localized supporting line. */
  subline: string;
  /** Optional pre-localized freeze-token reassurance (anti-shaming safety net). */
  freezeNote?: string;
  className?: string;
}

/** Warm flame glyph in a soft amber disc — celebratory, not alarming (DESIGN.md §7). */
function FlameGlyph() {
  return (
    <span
      aria-hidden
      className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-card)]"
      style={{ backgroundColor: "color-mix(in srgb, var(--color-star) 22%, transparent)" }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-star)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2c1 3-1.5 4.5-1.5 7A3.5 3.5 0 0 0 14 12c0-1 .5-2 .5-2 .8 1 2.5 2.6 2.5 5a5 5 0 1 1-10 0c0-3.5 4-5.5 5-13z" />
      </svg>
    </span>
  );
}

/**
 * Streak badge (DESIGN.md §9 "streak / progress"; AGENTS §0 anti-shaming tone). Presentational:
 * copy is localized in the app and passed in (a streak of 0 is framed as an invitation, never a
 * failure; freeze tokens as a reassuring safety net). Values derived server-side — no logic here.
 */
export function StreakBadge({ title, subline, freezeNote, className }: StreakBadgeProps) {
  return (
    <Card className={className}>
      <div className="flex items-center gap-4">
        <FlameGlyph />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            className="text-base font-bold"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {title}
          </span>
          <span className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {subline}
          </span>
          {freezeNote ? (
            <span className="mt-1 text-xs" style={{ color: "var(--color-secondary)" }}>
              {freezeNote}
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
