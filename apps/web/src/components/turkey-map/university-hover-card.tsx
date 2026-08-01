"use client";

import { useTranslations } from "next-intl";
import type { UniversityDto } from "@mentor/types";

export interface HoverAnchor {
  university: UniversityDto;
  /** Bounding box of the pin, in viewport coordinates. */
  rect: DOMRect;
}

const CARD_WIDTH = 240;
const CARD_HEIGHT = 120;
const GAP = 10;

/**
 * Hover summary for a map pin — the same shape as the calendar's event preview
 * (`PlanEventPreview`): fixed positioning from the anchor's rect, flipped when it would leave the
 * viewport, and `pointer-events-none` so it can never steal the hover that spawned it.
 *
 * Read-only by design, which is what keeps it free of focus management. The keyboard route to the
 * same information is the sidebar list, since the map SVG is `aria-hidden`.
 */
export function UniversityHoverCard({ anchor }: { anchor: HoverAnchor | null }) {
  const t = useTranslations("vision.map");
  if (!anchor) return null;

  const { university, rect } = anchor;

  const left = Math.max(
    GAP,
    Math.min(rect.left + rect.width / 2 - CARD_WIDTH / 2, window.innerWidth - CARD_WIDTH - GAP),
  );
  const above = rect.top - CARD_HEIGHT - GAP;
  const top = above > GAP ? above : rect.bottom + GAP;

  return (
    <div
      role="tooltip"
      aria-live="polite"
      className="pointer-events-none fixed z-[60] flex flex-col gap-1.5 rounded-[var(--radius-card)] border p-3 shadow-[var(--shadow-card)]"
      style={{
        left,
        top,
        width: CARD_WIDTH,
        borderColor: "var(--color-border, #e2e2e2)",
        backgroundColor: "var(--color-surface, #fff)",
      }}
    >
      <p
        className="text-sm font-bold leading-snug"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        {university.name}
      </p>

      <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
        {t(`kind.${university.kind}`)}
      </p>

      <p className="text-xs" style={{ color: "var(--color-body)" }}>
        {t("program_count", { count: university.programCount })}
      </p>

      <p className="text-[11px]" style={{ color: "var(--color-secondary)" }}>
        {t("open_hint")}
      </p>
    </div>
  );
}
