"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { CityDto, UniversityDto } from "@mentor/types";
import { PROVINCES } from "./paths.generated";
import { projectLngLat } from "./projection";
import type { HoverAnchor } from "./university-hover-card";
import { useMapViewport } from "./use-map-viewport";

/** Official ÖSYM YKS programs & quotas guide — linked from the map source note. */
const OSYM_YKS_GUIDE_URL =
  "https://www.osym.gov.tr/2026-yuksekogretim-kurumlari-sinavi-yks-yuksekogretim-programlari-ve-kontenjanlari-kilavuzu";

/**
 * Teardrop map pin whose tip sits at (0,0), so a pin translated to a projected point marks that
 * exact spot rather than hovering above or below it. ~14 wide, ~20 tall at unit scale.
 */
const PIN_PATH = "M0,0 C-4,-6 -7,-9 -7,-13 A7,7 0 1,1 7,-13 C7,-9 4,-6 0,0 Z";
/** Classic location pin size at country zoom — readable without burying dense clusters. */
const PIN_SCALE_DESKTOP = 0.95;
/** Larger on touch — country-view pins need a fat-finger target. */
const PIN_SCALE_MOBILE = 1.35;
/**
 * How strongly pin SVG scale follows `unit` (view.w / world).
 * 1 = constant screen size at every zoom; 0 = grow fully with zoom.
 * Mid values grow on zoom while country view stays controlled.
 */
const PIN_ZOOM_FOLLOW = 0.35;

interface PlacedUniversity {
  x: number;
  y: number;
  university: UniversityDto;
  cityCode: string;
  cityName: string;
}

/**
 * The map: provinces plus one pin per university, at every zoom level.
 *
 * Pins stay on true coordinates — never offset. Overlap in dense provinces is the accepted
 * cost; a moved pin that looks like another city is worse than a stack.
 */
export function MapCanvas({
  cities,
  selectedCityCode,
  previewCityCode,
  spotlightUniversityId,
  visibleUniversityIds,
  showOsymSource = false,
  activeUniversityId,
  overlay,
  onSelectCity,
  onSelectUniversity,
  onHoverUniversity,
}: {
  cities: CityDto[];
  selectedCityCode: string | null;
  /** Sidebar search hover — paints the province like SVG `:hover`. */
  previewCityCode?: string | null;
  /** Search click — keep the university hover card anchored to the pin while the view moves. */
  spotlightUniversityId?: string | null;
  /**
   * When set, only these campuses keep a pin (geo search filter). `null` / omitted = all pins.
   */
  visibleUniversityIds?: ReadonlySet<string> | null;
  /** YKS map only — ÖSYM program/quota source note at the bottom-right. */
  showOsymSource?: boolean;
  activeUniversityId: string | null;
  /**
   * Anything to pin over a province — the mascot standing on the target city. Kept generic so the
   * map does not need to know about mascots, and rendered as an HTML layer rather than inside the
   * SVG so it keeps a constant size no matter how far the viewBox is zoomed.
   */
  overlay?: { cityCode: string; node: React.ReactNode } | null;
  /** `null` clears the selection (province toggle-off). */
  onSelectCity: (code: string | null) => void;
  onSelectUniversity: (university: UniversityDto) => void;
  /** `null` starts dismiss; non-null shows the preview next to the pin. */
  onHoverUniversity: (anchor: HoverAnchor | null) => void;
}) {
  const t = useTranslations("vision.map");
  const reduceMotion = useReducedMotion();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const {
    view,
    viewBox,
    unit,
    isZoomed,
    isPanning,
    reset,
    zoomToBox,
    zoomIn,
    zoomOut,
    consumeClickSuppression,
    handlers,
  } = useMapViewport();
  const prevCityRef = useRef<string | null | undefined>(undefined);
  const [pinScale, setPinScale] = useState(PIN_SCALE_DESKTOP);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setPinScale(mq.matches ? PIN_SCALE_DESKTOP : PIN_SCALE_MOBILE);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Frame the selected province (map click or sidebar). Clearing the chip zooms back out.
  useEffect(() => {
    const prev = prevCityRef.current;
    prevCityRef.current = selectedCityCode;

    // Skip the very first undefined→null paint so we don't animate a reset on mount with no goal.
    if (prev === undefined && selectedCityCode == null) return;

    if (selectedCityCode == null) {
      reset();
      return;
    }
    const shape = PROVINCES[selectedCityCode];
    if (shape) zoomToBox(shape.bbox);
  }, [selectedCityCode, reset, zoomToBox]);

  const overlayShape = overlay ? PROVINCES[overlay.cityCode] : null;
  const overlayPos = overlayShape
    ? {
        left: ((overlayShape.cx - view.x) / view.w) * 100,
        top: ((overlayShape.cy - view.y) / view.h) * 100,
      }
    : null;
  // Hide it once the city is panned off screen instead of pinning it to the nearest edge, where
  // it would claim to mark a place it no longer points at.
  const overlayVisible =
    overlayPos != null &&
    overlayPos.left >= 0 &&
    overlayPos.left <= 100 &&
    overlayPos.top >= 0 &&
    overlayPos.top <= 100;

  const placed = useMemo<PlacedUniversity[]>(() => {
    const out: PlacedUniversity[] = [];
    for (const city of cities) {
      for (const university of city.universities) {
        // 16 of 206 have no confirmed fix. They stay in the sidebar list but get no pin — a gap
        // is honest, a pin in the wrong place is not.
        if (university.latitude == null || university.longitude == null) continue;
        if (visibleUniversityIds && !visibleUniversityIds.has(university.id)) continue;
        const { x, y } = projectLngLat(university.longitude, university.latitude);
        out.push({
          x,
          y,
          university,
          cityCode: city.code,
          cityName: city.name,
        });
      }
    }
    // Northernmost drawn first so southern pins overlap on top — the tip of a lower pin then
    // stays visible instead of being buried under its neighbour's head.
    return out.sort((a, b) => a.y - b.y);
  }, [cities, visibleUniversityIds]);

  const onHoverUniversityRef = useRef(onHoverUniversity);
  onHoverUniversityRef.current = onHoverUniversity;

  // Search-result click: keep the hover card on the pin while zoom/pan animates (`viewBox` ticks).
  useEffect(() => {
    if (!spotlightUniversityId) return;
    const item = placed.find((p) => p.university.id === spotlightUniversityId);
    const pin = svgRef.current?.querySelector(
      `[data-university-id="${CSS.escape(spotlightUniversityId)}"]`,
    );
    if (!item || !(pin instanceof SVGGElement)) return;
    onHoverUniversityRef.current({
      university: item.university,
      cityCode: item.cityCode,
      cityName: item.cityName,
      rect: pin.getBoundingClientRect(),
    });
  }, [spotlightUniversityId, placed, viewBox]);

  if (Object.keys(PROVINCES).length === 0) return null;

  return (
    <motion.div
      className="relative h-full w-full"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <svg
        ref={svgRef}
        viewBox={viewBox}
        aria-hidden="true"
        className={[
          "mentor-tr-map h-full w-full touch-none",
          isPanning ? "cursor-grabbing" : isZoomed ? "cursor-grab" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onMouseLeave={() => {
          if (!spotlightUniversityId) onHoverUniversity(null);
        }}
        {...handlers}
      >
        {Object.entries(PROVINCES).map(([code, shape]) => (
          <path
            key={code}
            d={shape.d}
            data-selected={code === selectedCityCode || undefined}
            data-preview={code === previewCityCode || undefined}
            onClick={() => {
              if (consumeClickSuppression()) return;
              // Same province again → clear + zoom out; another province → reframe while zoomed.
              onSelectCity(code === selectedCityCode ? null : code);
            }}
          />
        ))}

        {placed.map((item) => {
          const active = item.university.id === activeUniversityId;
          // Partial zoom follow: country zoom stays compact; city zoom grows the pin on screen.
          const scale = pinScale * Math.pow(unit, PIN_ZOOM_FOLLOW);
          return (
            <g
              key={item.university.id}
              className="mentor-tr-map-pin"
              data-university-id={item.university.id}
              data-active={active || undefined}
              transform={`translate(${item.x},${item.y}) scale(${scale})`}
              onClick={(e) => {
                e.stopPropagation();
                if (consumeClickSuppression()) return;
                // Pins always select (never toggle off) — opening a campus is affirmative.
                onSelectCity(item.cityCode);
                onSelectUniversity(item.university);
              }}
              onMouseEnter={(e) =>
                onHoverUniversity({
                  university: item.university,
                  cityCode: item.cityCode,
                  cityName: item.cityName,
                  rect: (e.currentTarget as SVGGElement).getBoundingClientRect(),
                })
              }
              onMouseLeave={() => {
                if (!spotlightUniversityId) onHoverUniversity(null);
              }}
            >
              <path d={PIN_PATH} />
              <circle cy={-13} r={3.2} />
            </g>
          );
        })}
      </svg>

      {overlay && overlayVisible ? (
        <motion.div
          className="pointer-events-none absolute z-10"
          style={{
            left: `${overlayPos!.left}%`,
            top: `${overlayPos!.top}%`,
          }}
          initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <div style={{ transform: "translate(-50%, -100%)" }}>{overlay.node}</div>
        </motion.div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
        <p
          className="max-w-[9rem] text-[11px] leading-snug sm:max-w-none"
          style={{ color: "var(--color-secondary)" }}
        >
          {t("attribution")}
        </p>
        <div className="flex max-w-[min(100%,20rem)] items-end gap-2 sm:max-w-[24rem]">
          {showOsymSource ? (
            <p
              className="pointer-events-auto min-w-0 flex-1 text-right text-[11px] leading-snug"
              style={{ color: "var(--color-secondary)" }}
            >
              {t.rich("osym_source", {
                link: (chunks) => (
                  <a
                    href={OSYM_YKS_GUIDE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                    style={{ color: "var(--color-main)" }}
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
          ) : null}
          <div className="pointer-events-auto flex shrink-0 flex-col gap-1">
            <ZoomButton label={t("zoom_in")} onClick={zoomIn}>
              +
            </ZoomButton>
            <ZoomButton label={t("zoom_out")} onClick={zoomOut}>
              −
            </ZoomButton>
            {isZoomed ? (
              <ZoomButton label={t("zoom_reset")} onClick={reset}>
                ⤢
              </ZoomButton>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ZoomButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--radius-card)] border text-base font-bold shadow-[var(--shadow-card)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
      style={{
        borderColor: "var(--color-border, #e2e2e2)",
        backgroundColor: "var(--color-surface, #fff)",
        color: "var(--color-main)",
      }}
    >
      {children}
    </button>
  );
}
