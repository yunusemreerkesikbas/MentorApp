"use client";

import { useTranslations } from "next-intl";
import type { UniversityDto } from "@mentor/types";

export interface HoverAnchor {
  university: UniversityDto;
  cityName: string;
  cityCode: string;
  /** Bounding box of the pin, in viewport coordinates. */
  rect: DOMRect;
}

const CARD_WIDTH = 240;
const CARD_HEIGHT = 132;
const GAP = 10;

/**
 * Hover summary for a map pin — calendar `PlanEventPreview` layout: fixed from the pin rect,
 * flipped when it would leave the viewport.
 *
 * City sits under the university title (not as a map label): the pin already points at a campus,
 * so the card carries that context without painting province names across the SVG.
 * Click opens the same sidebar detail as the pin.
 */
export function UniversityHoverCard({
  anchor,
  active = false,
  onHoverRetain,
  onHoverRelease,
  onOpen,
}: {
  anchor: HoverAnchor | null;
  /** Pin/search click — card stays until focus clears; stronger border signals that. */
  active?: boolean;
  onHoverRetain?: () => void;
  onHoverRelease?: () => void;
  onOpen?: (anchor: HoverAnchor) => void;
}) {
  const t = useTranslations("vision.map");
  if (!anchor) return null;

  const { university, cityName, rect } = anchor;

  const left = Math.max(
    GAP,
    Math.min(rect.left + rect.width / 2 - CARD_WIDTH / 2, window.innerWidth - CARD_WIDTH - GAP),
  );
  const above = rect.top - CARD_HEIGHT - GAP;
  const top = above > GAP ? above : rect.bottom + GAP;

  return (
    <button
      type="button"
      aria-label={t("open_university_aria", { name: university.name })}
      data-active={active || undefined}
      onMouseEnter={onHoverRetain}
      onMouseLeave={onHoverRelease}
      onClick={() => onOpen?.(anchor)}
      className="fixed z-[60] flex cursor-pointer flex-col gap-1 rounded-[var(--radius-card)] border p-3 text-left shadow-[var(--shadow-card)] transition-colors hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
      style={{
        left,
        top,
        width: CARD_WIDTH,
        borderColor: active ? "var(--color-main)" : "var(--color-border, #e2e2e2)",
        backgroundColor: "var(--color-surface, #fff)",
      }}
    >
      <span
        className="text-sm font-bold leading-snug"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        {university.name}
      </span>

      <span className="text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
        {cityName}
      </span>

      <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
        {t(`kind.${university.kind}`)} · {t("program_count", { count: university.programCount })}
      </span>

      <span className="text-[11px]" style={{ color: "var(--color-secondary)" }}>
        {t("open_hint")}
      </span>
    </button>
  );
}
