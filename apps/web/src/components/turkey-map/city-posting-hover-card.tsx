"use client";

import { useTranslations } from "next-intl";
import type { CityPinAnchor } from "./map-canvas";

const CARD_WIDTH = 240;
const CARD_HEIGHT = 118;
const GAP = 10;

/**
 * Hover summary for a KPSS province pin — the counterpart of `UniversityHoverCard`, same
 * positioning rules (fixed from the pin rect, flipped at the viewport edge).
 *
 * A separate component rather than a generic one: the two cards agree on layout but not on
 * meaning. A campus card names a place you can attend; this one reports how many vacancies one
 * guide advertised in a province — which is why the round is printed on it and never omitted.
 */
export function CityPostingHoverCard({
  anchor,
  round,
  onHoverRetain,
  onHoverRelease,
  onOpen,
}: {
  anchor: CityPinAnchor | null;
  round: string | null;
  onHoverRetain?: () => void;
  onHoverRelease?: () => void;
  onOpen?: (anchor: CityPinAnchor) => void;
}) {
  const t = useTranslations("vision.kpss");
  if (!anchor) return null;

  const left = Math.max(
    GAP,
    Math.min(
      anchor.rect.left + anchor.rect.width / 2 - CARD_WIDTH / 2,
      window.innerWidth - CARD_WIDTH - GAP,
    ),
  );
  const above = anchor.rect.top - CARD_HEIGHT - GAP;
  const top = above > GAP ? above : anchor.rect.bottom + GAP;

  return (
    <button
      type="button"
      aria-label={t("open_city_aria", { name: anchor.cityName })}
      onMouseEnter={onHoverRetain}
      onMouseLeave={onHoverRelease}
      onClick={() => onOpen?.(anchor)}
      className="fixed z-[60] flex cursor-pointer flex-col gap-1 rounded-[var(--radius-card)] border p-3 text-left shadow-[var(--shadow-card)] transition-colors hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
      style={{
        left,
        top,
        width: CARD_WIDTH,
        borderColor: "var(--color-border, #e2e2e2)",
        backgroundColor: "var(--color-surface, #fff)",
      }}
    >
      <span
        className="text-sm font-bold leading-snug"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        {anchor.cityName}
      </span>

      <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
        {t("city_summary", { postings: anchor.postings, quota: anchor.quota })}
      </span>

      {round ? (
        <span className="text-[11px]" style={{ color: "var(--color-secondary)" }}>
          {t("round_note", { round })}
        </span>
      ) : null}

      <span className="text-[11px]" style={{ color: "var(--color-secondary)" }}>
        {t("open_hint")}
      </span>
    </button>
  );
}
