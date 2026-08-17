"use client";

import { useTranslations } from "next-intl";
import type { UniversityDto } from "@mentor/types";

import { Link } from "@/i18n/navigation";

export interface HoverAnchor {
  university: UniversityDto;
  cityName: string;
  cityCode: string;
  /** Bounding box of the pin, in viewport coordinates. */
  rect: DOMRect;
}

const CARD_WIDTH = 240;
const CARD_HEIGHT = 132;
const CARD_HEIGHT_WITH_SIMULATION = 188;
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
  simulation,
}: {
  anchor: HoverAnchor | null;
  /** Pin/search click — card stays until focus clears; stronger border signals that. */
  active?: boolean;
  onHoverRetain?: () => void;
  onHoverRelease?: () => void;
  onOpen?: (anchor: HoverAnchor) => void;
  simulation?: { universityId: string; label: string } | null;
}) {
  const t = useTranslations("vision.map");
  if (!anchor) return null;

  const { university, cityName, rect } = anchor;

  const left = Math.max(
    GAP,
    Math.min(rect.left + rect.width / 2 - CARD_WIDTH / 2, window.innerWidth - CARD_WIDTH - GAP),
  );
  const cardHeight = simulation ? CARD_HEIGHT_WITH_SIMULATION : CARD_HEIGHT;
  const above = rect.top - cardHeight - GAP;
  const top = above > GAP ? above : rect.bottom + GAP;

  return (
    <div
      data-active={active || undefined}
      onMouseEnter={onHoverRetain}
      onMouseLeave={onHoverRelease}
      onFocusCapture={onHoverRetain}
      onBlurCapture={onHoverRelease}
      className="fixed z-[60] overflow-hidden rounded-[var(--radius-card)] border text-left shadow-[var(--shadow-card)]"
      style={{
        left,
        top,
        width: CARD_WIDTH,
        borderColor: active ? "var(--color-main)" : "var(--color-border)",
        backgroundColor: "var(--color-surface)",
      }}
      data-testid="university-hover-card"
    >
      <button
        type="button"
        aria-label={t("open_university_aria", { name: university.name })}
        onClick={() => onOpen?.(anchor)}
        className="flex w-full cursor-pointer flex-col gap-1 p-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_2%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
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

      {simulation ? (
        <Link
          href={{
            pathname: "/vision-board/simulation",
            query: { universityId: simulation.universityId },
          }}
          className="mx-3 mb-3 inline-flex min-h-11 w-[calc(100%-1.5rem)] items-center justify-center rounded-[var(--radius-control)] px-3 text-center text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{
            backgroundColor: "var(--color-accent)",
            color: "var(--color-on-accent)",
          }}
        >
          {simulation.label}
        </Link>
      ) : null}
    </div>
  );
}
