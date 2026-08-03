import { Flame } from "lucide-react";
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
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--color-star) 22%, transparent)",
      }}
    >
      <Flame size={24} color="var(--color-star)" strokeWidth={2} />
    </span>
  );
}

/**
 * Streak badge (DESIGN.md §9 "streak / progress"; AGENTS §0 anti-shaming tone). Presentational:
 * copy is localized in the app and passed in (a streak of 0 is framed as an invitation, never a
 * failure; freeze tokens as a reassuring safety net). Values derived server-side — no logic here.
 */
export function StreakBadge({
  title,
  subline,
  freezeNote,
  className,
}: StreakBadgeProps) {
  return (
    <Card className={className}>
      <div className="flex items-center gap-4">
        <FlameGlyph />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            className="text-base font-bold"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {title}
          </span>
          <span className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {subline}
          </span>
          {freezeNote ? (
            <span
              className="mt-1 text-xs"
              style={{ color: "var(--color-secondary)" }}
            >
              {freezeNote}
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
